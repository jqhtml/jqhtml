# RSpade Framework Integration with JQHTML

> **Last Updated**: October 7, 2025
> **Status**: This document has not been reviewed since the November 2025 documentation updates. Content may be outdated. A comprehensive audit and update is pending.

## Overview

RSpade integrates JQHTML components directly into Blade templates, allowing components to be used with native Blade syntax. This provides seamless server-side and client-side component composition.

## Using JQHTML Components in Blade

### Self-Closing Components

```blade
<UserCard $user_id="123" $theme="dark" />
```

### Components with Content

```blade
<Panel $title="Settings">
  <p>Panel content here</p>
  <button>Save</button>
</Panel>
```

## How It Works

### Component Discovery

1. JQHTML components defined in `.jqhtml` files
2. Paired JavaScript classes extend `Jqhtml_Component`
3. RSpade bundle system includes component files
4. Components automatically available in Blade

### Rendering Process

1. **Server-side**: Blade processes component tags
2. **Client-side**: JQHTML initializes component instances
3. **Lifecycle runs**: render → create → load → ready
4. **Result**: Fully interactive component

## Server-Rendered Content

### _inner_html Integration

RSpade can provide server-rendered HTML to components:

```blade
<Card>
  @php
    // Blade generates content server-side
  @endphp
  <p>{{ $user->name }}</p>
  <p>{{ $user->email }}</p>
</Card>
```

Behind the scenes, RSpade passes this as `_inner_html` to the component, bypassing client-side `content()` rendering.

## Bundle System Integration

### Including Components in Bundles

```php
class FrontendBundle extends RsxBundleAbstract
{
    public static function define(): array
    {
        return [
            'include' => [
                'jquery',                           // Required
                'jqhtml',                          // JQHTML runtime
                'rsx/theme/components',            // Component directory
                'rsx/app/frontend/user_card.jqhtml',  // Specific component
                'rsx/app/frontend/user_card.js',      // Component class
            ],
        ];
    }
}
```

### Component File Pairs

```
rsx/app/frontend/
├── user_card.jqhtml        # Template definition
├── user_card.js            # JavaScript class
└── user_card.scss          # Styles (optional)
```

**Convention**: Files with same base name are related.

## Blade Component Syntax

### Passing Arguments

```blade
{{-- Quoted strings --}}
<UserCard $title="User Profile" />

{{-- Blade expressions --}}
<UserCard $user_id="{{ $user->id }}" />

{{-- Dynamic values --}}
<UserCard
  $user_id="{{ $user->id }}"
  $theme="{{ $theme }}"
  $editable="true"
/>
```

### Nesting in Blade

```blade
<AppLayout>
  <Dashboard>
    <StatsGrid>
      <StatCard $label="Users" $value="{{ $user_count }}" />
      <StatCard $label="Revenue" $value="{{ $revenue }}" />
    </StatsGrid>
  </Dashboard>
</AppLayout>
```

## Component Lifecycle in RSpade

### Automatic Initialization

When bundle renders, JQHTML auto-initializes all components:

```blade
<!DOCTYPE html>
<html>
<head>
  {!! FrontendBundle::render() !!}
</head>
<body>
  <UserCard $user_id="123" />
  {{-- Component automatically initializes on page load --}}
</body>
</html>
```

### on_app_ready() Hook

RSpade provides application-level lifecycle hook:

```javascript
class FrontendIndex {
  static async on_app_ready() {
    // DOM ready, all scripts loaded, BEFORE components initialize
    console.log('App ready');
  }

  static async on_jqhtml_ready() {
    // After all JQHTML components fully initialized
    console.log('Components ready');
  }
}
```

## Ajax Endpoints and Components

### Returning Component HTML

```php
#[AjaxEndpoint]
public static function load_user_card(Request $request, array $params = [])
{
    $user = UserModel::find($params['user_id']);

    // Return component HTML
    return [
        'success' => true,
        'html' => view('user_card_partial')
            ->with('user', $user)
            ->render(),
    ];
}
```

**JavaScript:**

```javascript
const result = await DashboardController.load_user_card({user_id: 123});
$('#container').html(result.html);

// Component auto-initializes in new HTML
```

## Model Integration

### Passing Model Data to Components

```blade
@foreach($users as $user)
  <UserCard
    $user_id="{{ $user->id }}"
    $name="{{ $user->name }}"
    $email="{{ $user->email }}"
  />
@endforeach
```

### Loading Data Client-Side

```javascript
class UserCard extends Jqhtml_Component {
  async on_load() {
    // Fetch from RSpade Ajax endpoint
    const result = await UserController.get_user_data({
      user_id: this.args.user_id
    });

    this.data = result.user;
  }
}
```

## Blade Directives and JQHTML

### Mixing Blade and JQHTML

```blade
<div class="user-list">
  @if($users->count() > 0)
    <UserList>
      @foreach($users as $user)
        <UserCard $user_id="{{ $user->id }}" />
      @endforeach
    </UserList>
  @else
    <EmptyState $message="No users found" />
  @endif
</div>
```

## Component Routes

### Components on Route Pages

```php
class FrontendUsersController extends RsxControllerAbstract
{
    #[Auth('Permission::anybody()')]
    #[Route('/users')]
    public static function index(Request $request, array $params = [])
    {
        $users = UserModel::all();

        return view('frontend_users_index')
            ->with('users', $users)
            ->with('bundle', FrontendBundle::render());
    }
}
```

**frontend_users_index.blade.php:**

```blade
@rsx_id('FrontendUsersIndex')

<!DOCTYPE html>
<html>
<head>
  {!! $bundle !!}
</head>
<body class="{{ rsx_body_class() }}">
  <UserList>
    @foreach($users as $user)
      <UserCard $user_id="{{ $user->id }}" />
    @endforeach
  </UserList>
</body>
</html>
```

## Theme Components

### Global Components

```
rsx/theme/components/
├── card.jqhtml
├── Card.js
├── button.jqhtml
├── Button.js
├── modal.jqhtml
└── Modal.js
```

Include in bundle:

```php
'include' => [
    'rsx/theme/components',  // All components in directory
]
```

Use anywhere:

```blade
<Card>
  <Button $onclick="handleClick">Click Me</Button>
</Card>
```

## Important Concepts

1. **Native Blade syntax** - Use components directly in Blade
2. **Self-closing or with content** - Both syntaxes supported
3. **Bundle includes components** - Must be in bundle to work
4. **Auto-initialization** - Components initialize automatically
5. **Server + client rendering** - Blade renders, JQHTML enhances
6. **_inner_html for server content** - Server-rendered HTML integration
7. **File naming convention** - Match .jqhtml and .js names
8. **Theme components** - Reusable across application

## Key Integration Points

### RSpade Provides

- Bundle system for asset compilation
- Blade syntax for component usage
- Ajax endpoint system for data loading
- Route-based page organization
- Model integration

### JQHTML Provides

- Component templates (.jqhtml files)
- Component lifecycle (render, create, load, ready)
- Client-side interactivity
- jQuery-based DOM manipulation
- Component composition and nesting

### Together They Provide

- Server-rendered component structure
- Client-side component enhancement
- Seamless Blade + JQHTML composition
- Full-stack component architecture
- Rapid development workflow
