# JQHTML v2 Laravel Blade Integration

> ⚠️ **WORK IN PROGRESS** - This feature is incomplete and under active development. RSpade has implemented a custom variant of this integration for internal use. This documentation serves as a baseline specification and requires review, testing, and further development before public release. Known issues include incorrect use of `data-props` patterns that need updating to proper JQHTML $ attribute semantics.

## Overview

A Laravel package that enables seamless integration between Blade templates and JQHTML components, providing server-side rendering fallbacks and progressive enhancement.

## Design Philosophy

- **Progressive Enhancement**: Components work without JavaScript via `<noscript>` fallbacks
- **SEO Friendly**: Search engines see meaningful content
- **Clean Blade Syntax**: Natural component usage in Blade templates
- **Automatic Initialization**: Components self-register on page load
- **Hydration Pattern**: Server renders structure, client enhances behavior

## Fallback / SEO Rendering: Use @jqhtml/ssr

Real fallback/SEO content should come from **`@jqhtml/ssr`** (`packages/ssr`), not from a
hand-written PHP reimplementation of every component's markup. `@jqhtml/ssr` is a Node.js
server (`bin: jqhtml-ssr`, `src/server.js`, "Server-Side Rendering for JQHTML components
- renders components to HTML for SEO") purpose-built for exactly this case: it runs the
*same* component code server-side inside jsdom - including real `on_load()` HTTP calls -
so the fallback HTML can't drift out of sync with what the client would actually render.

**Recommended architecture:** the Laravel package's fallback renderer should be a thin
client that shells out to / proxies a running `jqhtml-ssr` process (TCP or Unix socket -
see `packages/ssr/README.md` and `packages/ssr/SPECIFICATION.md` for the wire protocol
and `jqhtml-ssr-example` for a reference client in any language), passing the component
name and args and returning the HTML it gets back for the `<noscript>` block:

```php
namespace App\Jqhtml;

class FallbackRenderer
{
    public function __construct(private JqhtmlSsrClient $ssr) {}

    public function render(string $component, array $props): string
    {
        // Delegates to the jqhtml-ssr server instead of duplicating
        // each component's markup by hand in PHP.
        return $this->ssr->render($component, $props);
    }
}
```

The hand-written, `match()`-based PHP renderer shown later in "Custom Fallback Renderer"
is a fallback-of-last-resort for deployments that deliberately cannot run a persistent
Node.js SSR process - it duplicates template markup by hand and will silently drift from
the real components over time, so prefer proxying to `@jqhtml/ssr` whenever Node is
available.

## Blade Directive Syntax

### Basic Usage

```blade
{{-- Simple component --}}
<x-jqhtml:UserCard name="John Doe" />

{{-- With attributes --}}
<x-jqhtml:DataTable 
    :items="$users" 
    :columns="['name', 'email']"
    sortable="true" />

{{-- With slot content --}}
<x-jqhtml:Card title="Users">
    <x-slot:header>
        <h2>Active Users</h2>
    </x-slot:header>
    
    User content here...
</x-jqhtml:Card>
```

### Alternative Directive Syntax

```blade
{{-- Using @jqhtml directive --}}
@jqhtml('UserCard', ['name' => 'John Doe'])

{{-- With content --}}
@jqhtml('Card', ['title' => 'Users'])
    Card content here...
@endjqhtml
```

## HTML Output Structure

The wrapper must emit the same placeholder shape that `@jqhtml/core`'s `boot()` already
knows how to hydrate (see `packages/core/src/boot.ts`), rather than a bespoke
`data-component`/`data-props` scheme: a `_Component_Init` class plus
`data-component-init-name` / `data-component-args` attributes.

### Component Wrapper

```html
<!-- Output from <x-jqhtml:UserCard name="John Doe" role="admin" /> -->
<div class="_Component_Init"
     data-component-init-name="UserCard"
     data-component-args='{"name":"John Doe","role":"admin"}'>

    <!-- Fallback content for no-JS / SEO. boot() clears this innerHTML
         before hydrating, so it's safe to put real markup here. -->
    <noscript>
        <div class="user-card">
            <h3>John Doe</h3>
            <p>Role: admin</p>
        </div>
    </noscript>
</div>
```

### After Client Initialization

`jqhtml.boot()` strips the `_Component_Init` class and the `data-component-init-name`
/`data-component-args` attributes, then hydrates the element in place via
`$element.component(name, args)`. Once every top-level placeholder is ready, `boot()`
resolves and a `jqhtml:ready` `CustomEvent` fires on `document`:

```html
<div class="UserCard Component" data-cid="abc123xyz">
    <!-- Component's rendered content -->
    <div class="user-card">
        <h3>John Doe</h3>
        <p>Role: admin</p>
        <button>Edit</button>
    </div>
</div>
```

## Laravel Package Structure

```
jqhtml-laravel/
├── src/
│   ├── JqhtmlServiceProvider.php
│   ├── Components/
│   │   ├── JqhtmlComponent.php      # Base component class
│   │   └── ComponentRegistry.php     # Component registration
│   ├── Blade/
│   │   ├── Directives.php           # Blade directives
│   │   └── Components.php           # Blade component resolver
│   ├── Facades/
│   │   └── Jqhtml.php
│   └── Helpers/
│       ├── PropEncoder.php          # JSON encoding for props
│       └── FallbackRenderer.php     # Noscript content generation
├── resources/
│   ├── views/
│   │   └── components/
│   │       └── wrapper.blade.php    # Component wrapper template
│   └── js/
│       └── initializer.js           # Client-side initialization
└── config/
    └── jqhtml.php                   # Package configuration
```

## Implementation Details

### 1. Service Provider

```php
namespace Jqhtml\Laravel;

class JqhtmlServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Register Blade components
        $this->loadViewComponentsAs('jqhtml', [
            DynamicComponent::class,
        ]);
        
        // Register Blade directives
        Blade::directive('jqhtml', function ($expression) {
            return "<?php echo app('jqhtml')->render($expression); ?>";
        });
        
        // Publish config
        $this->publishes([
            __DIR__.'/../config/jqhtml.php' => config_path('jqhtml.php'),
        ], 'config');
        
        // Publish JS assets
        $this->publishes([
            __DIR__.'/../resources/js' => public_path('vendor/jqhtml'),
        ], 'assets');
    }
}
```

### 2. Dynamic Component Class

```php
namespace Jqhtml\Laravel\Components;

use Illuminate\View\Component;

class JqhtmlComponent extends Component
{
    public string $component;
    public array $props;
    public ?string $fallbackView;
    
    public function __construct(string $component, array $props = [])
    {
        $this->component = $component;
        $this->props = $this->prepareProps($props);
        $this->fallbackView = $this->resolveFallbackView();
    }
    
    public function render()
    {
        return view('jqhtml::wrapper', [
            'component' => $this->component,
            'props' => $this->props,
            'propsJson' => $this->getPropsJson(),
            'fallbackContent' => $this->getFallbackContent(),
        ]);
    }
    
    protected function getPropsJson(): string
    {
        return htmlspecialchars(json_encode($this->props), ENT_QUOTES, 'UTF-8');
    }
    
    protected function getFallbackContent(): string
    {
        if ($this->fallbackView && view()->exists($this->fallbackView)) {
            return view($this->fallbackView, $this->props)->render();
        }
        
        return app(FallbackRenderer::class)->render($this->component, $this->props);
    }
}
```

### 3. Wrapper Template

```blade
{{-- resources/views/components/wrapper.blade.php --}}
<div class="_Component_Init"
     data-component-init-name="{{ $component }}"
     data-component-args='{{ $propsJson }}'>

    {{-- boot() clears the placeholder's innerHTML before hydrating, so
         real fallback/SEO markup can live here directly - no separate
         "placeholder" div or data-state flag needed. --}}
    <noscript>
        {!! $fallbackContent !!}
    </noscript>
</div>
```

### 4. Client-Side Initializer

The real hydration entry point is `boot()` from `@jqhtml/core` (see
`packages/core/src/boot.ts`) - it already finds every `_Component_Init` placeholder,
instantiates the matching registered component with its `data-component-init-name`/
`data-component-args`, and waits for the full lifecycle to reach `ready`. The Laravel
package's initializer should be a thin wrapper around it rather than re-implementing
placeholder discovery and lifecycle waiting by hand:

```javascript
// resources/js/initializer.js
import { boot } from '@jqhtml/core';
import './components'; // side-effect import that registers every component
                        // class/template via jqhtml.register()/register_component()
                        // - boot() only hydrates components that are already
                        // registered, it does not lazily import component code

class JqhtmlLaravelInitializer {
    constructor(options = {}) {
        this.options = {
            scope: document.body,
            ...options
        };
    }

    // Hydrate all _Component_Init placeholders currently in the DOM.
    // Resolves once every top-level component is ready; also fires a
    // `jqhtml:ready` CustomEvent on `document` at the same time.
    async init() {
        await boot(this.options.scope);
    }

    // Watch for new placeholders (useful for AJAX-injected content) and
    // hydrate just the new subtree.
    observe() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue; // Element nodes only
                    if (node.matches('._Component_Init') || node.querySelector('._Component_Init')) {
                        boot(node);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    const initializer = new JqhtmlLaravelInitializer();
    await initializer.init();
    initializer.observe(); // Watch for dynamic content
});

// Export for manual use
export default JqhtmlLaravelInitializer;
```

## Configuration

```php
// config/jqhtml.php
return [
    // Component discovery paths
    'components' => [
        'paths' => [
            resource_path('js/components'),
            public_path('vendor/components'),
        ],
        
        // Component name to file mapping
        'aliases' => [
            'UserCard' => 'user/UserCard',
        ],
    ],
    
    // Fallback rendering
    'fallbacks' => [
        // Recommended: proxy to a running jqhtml-ssr process (see
        // "Fallback / SEO Rendering: Use @jqhtml/ssr" above)
        'ssr' => [
            'socket' => env('JQHTML_SSR_SOCKET', '/tmp/jqhtml-ssr.sock'),
        ],

        // Use Blade views for fallbacks
        'views' => [
            'UserCard' => 'components.fallbacks.user-card',
        ],
        
        // Or use a hand-written renderer class (last resort - see
        // "Custom Fallback Renderer (Last Resort)")
        'renderer' => \App\Jqhtml\FallbackRenderer::class,
    ],
    
    // Client-side options
    'client' => [
        'auto_init' => true,
        'component_path' => '/js/components/',
        'init_on_ajax' => true,
    ],
    
    // Development options
    'debug' => env('APP_DEBUG', false),
];
```

## Usage Examples

### 1. Basic Laravel Controller

```php
class UserController extends Controller
{
    public function index()
    {
        $users = User::paginate(20);
        
        return view('users.index', [
            'users' => $users,
            'columns' => ['name', 'email', 'created_at'],
        ]);
    }
}
```

### 2. Blade View

```blade
@extends('layouts.app')

@section('content')
    <h1>Users</h1>
    
    <x-jqhtml:DataTable 
        :items="$users->items()"
        :columns="$columns"
        :page="$users->currentPage()"
        :per-page="$users->perPage()"
        sortable="true"
        searchable="true">
        
        <x-slot:empty>
            <p>No users found.</p>
        </x-slot:empty>
    </x-jqhtml:DataTable>
    
    {{ $users->links() }}
@endsection

@push('scripts')
    <script src="{{ asset('vendor/jqhtml/initializer.js') }}"></script>
@endpush
```

### 3. Custom Fallback Renderer (Last Resort)

> See "Fallback / SEO Rendering: Use @jqhtml/ssr" above - proxying to a `jqhtml-ssr`
> process is the recommended approach. The hand-written renderer below is only for
> deployments that cannot run Node.js at all.

```php
namespace App\Jqhtml;

class FallbackRenderer
{
    public function render(string $component, array $props): string
    {
        return match($component) {
            'UserCard' => $this->renderUserCard($props),
            'DataTable' => $this->renderDataTable($props),
            default => $this->renderGeneric($component, $props),
        };
    }
    
    protected function renderUserCard(array $props): string
    {
        $name = e($props['name'] ?? 'Unknown');
        $role = e($props['role'] ?? 'User');
        
        return <<<HTML
        <div class="user-card-fallback">
            <h3>{$name}</h3>
            <p>Role: {$role}</p>
        </div>
        HTML;
    }
    
    protected function renderDataTable(array $props): string
    {
        $html = '<table class="data-table-fallback"><thead><tr>';
        
        // Render headers
        foreach ($props['columns'] ?? [] as $column) {
            $html .= '<th>' . e($column) . '</th>';
        }
        
        $html .= '</tr></thead><tbody>';
        
        // Render rows
        foreach ($props['items'] ?? [] as $item) {
            $html .= '<tr>';
            foreach ($props['columns'] ?? [] as $column) {
                $value = data_get($item, $column, '');
                $html .= '<td>' . e($value) . '</td>';
            }
            $html .= '</tr>';
        }
        
        $html .= '</tbody></table>';
        
        return $html;
    }
}
```

### 4. AJAX Integration

```javascript
// In your AJAX handler
fetch('/api/users')
    .then(response => response.text())
    .then(html => {
        document.getElementById('user-list').innerHTML = html;
        // Components in the new HTML will be automatically initialized
        // thanks to the MutationObserver
    });
```

## Advanced Features

### 1. Server-Side Props Processing

```php
class JqhtmlComponent extends Component
{
    protected function prepareProps(array $props): array
    {
        // Convert Eloquent models to arrays
        foreach ($props as $key => $value) {
            if ($value instanceof Model) {
                $props[$key] = $value->toArray();
            } elseif ($value instanceof Collection) {
                $props[$key] = $value->toArray();
            }
        }
        
        return $props;
    }
}
```

### 2. Conditional Loading

```blade
{{-- Only load component if user has permission --}}
@can('view-users')
    <x-jqhtml:UserList :users="$users" />
@else
    <p>You don't have permission to view users.</p>
@endcan
```

### 3. Livewire Integration

```php
// Livewire component that renders JQHTML components
class UserManager extends Component
{
    public function render()
    {
        return view('livewire.user-manager', [
            'users' => User::all(),
        ]);
    }
    
    public function updated()
    {
        // Emit event to reinitialize JQHTML components
        $this->emit('jqhtml:refresh');
    }
}
```

## Benefits

1. **SEO Friendly**: Content visible to search engines via noscript
2. **Progressive Enhancement**: Works without JavaScript
3. **Clean Syntax**: Natural Blade component syntax
4. **Performance**: Initial content rendered server-side
5. **Flexibility**: Mix server and client rendering as needed
6. **Laravel Integration**: Uses familiar Laravel patterns

## Security Considerations

1. **XSS Protection**: Props are HTML-escaped in data attributes
2. **JSON Encoding**: Proper encoding prevents injection
3. **CSRF**: Works with Laravel's CSRF protection
4. **Validation**: Server-side validation before rendering

## Performance Optimization

1. **Lazy Loading**: Components can be loaded on-demand
2. **Bundling**: Component code can be bundled by type
3. **Caching**: Fallback content can be cached
4. **CDN**: Static component files can be served from CDN

## Migration from Blade Components

```blade
{{-- Before: Pure Blade component --}}
<x-user-card :user="$user" />

{{-- After: JQHTML component with same interface --}}
<x-jqhtml:UserCard :user="$user" />
```

The migration is straightforward as the syntax remains familiar to Laravel developers.