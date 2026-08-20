# Semantic-First Design Philosophy

## The JQHTML Approach to UI Development

JQHTML was designed for developers who think mechanically rather than visually. Instead of wrestling with cryptic class names and maintaining mental mappings between CSS rules and jQuery selectors, JQHTML lets you **compose concepts in HTML documents**.

## The Problem with Traditional Approach

Traditional HTML development:

```html
<div class="page-wrapper">
  <div class="container-fluid">
    <div class="page-header">
      <h1 class="page-title">My Cool Page</h1>
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/pages">Pages</a></li>
          <li class="breadcrumb-item active">My Cool Page</li>
        </ol>
      </nav>
    </div>
    <div class="alert alert-info">
      <i class="bi bi-info-circle"></i>
      This Page is wicked cool
    </div>
    <div class="row">
      <div class="col-md-8">
        <div class="card">
          <div class="card-body">
            Some Details on this page
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="attribution">
          Author:
          <span class="user-mini" data-user-id="3">
            <!-- Complex user markup -->
          </span>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Problems**:
- Cryptic class names (`container-fluid`, `breadcrumb-item`, `col-md-8`)
- Mental mapping burden (what does each class do?)
- Unclear structure (is this a page? a section? a card?)
- CSS and jQuery selectors scattered everywhere
- Hard to maintain consistency
- Visual details mixed with logical structure

## The JQHTML Way

**Semantic, composable markup:**

```blade
<Page>
  <PageBody>
    <PageTitle>My cool page</PageTitle>

    <Breadcrumbs
      $major_section="Pages"
      $major_section_url="/pages"
      $minor_section_title="My Cool Page"
    />

    <NoticeBlock>
      This Page is wicked cool
    </NoticeBlock>

    <DetailsArea>
      <DetailBlock>
        Some Details on this page
      </DetailBlock>

      <Attribution>
        Author:
        <UserProfile_Mini $user_id="3" />
      </Attribution>
    </DetailsArea>

    <ButtonSet>
      <button class="btn btn-primary">My Button</button>
    </ButtonSet>

    <FormComponent>
      <UserSelector $default_id="3" />
      <FileUpload $sid="the_file_upload" />
    </FormComponent>
  </PageBody>

  <StickyFooter>
    <QuickStats />
  </StickyFooter>
</Page>
```

**Benefits**:
- **Readable**: Intent is immediately clear
- **Logical structure**: Components named for what they ARE, not how they look
- **No mental mapping**: `PageTitle` means exactly what it says
- **Composable**: Nest concepts naturally
- **Reusable**: Same components across entire project
- **Consistent styling**: Markup lives in component definition

## The Development Workflow

### 1. Start with Logical Structure

Write the page using semantic component names:

```blade
<Dashboard>
  <DashboardHeader>
    <DashboardTitle>Sales Dashboard</DashboardTitle>
    <DashboardActions>
      <RefreshButton />
      <ExportButton />
    </DashboardActions>
  </DashboardHeader>

  <StatsGrid>
    <StatCard $value="$45,230">Revenue</StatCard>
    <StatCard $value="1,234">Orders</StatCard>
    <StatCard $value="567">Customers</StatCard>
  </StatsGrid>

  <ChartArea>
    <SalesChart $period="monthly" />
  </ChartArea>
</Dashboard>
```

**This works immediately** - all undefined components render as divs with class names.

### 2. Style with CSS

Target components by name:

```scss
.Dashboard {
  padding: 2rem;

  .DashboardHeader {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2rem;
  }

  .StatsGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
}
```

### 3. Add Visual Details Later

Define component templates when needed:

```jqhtml
<Define:StatCard tag="article" class="card">
  <div class="card-body">
    <h5 class="card-title"><%= content() %></h5>
    <p class="card-text display-4"><%= this.args.value %></p>
  </div>
</Define:StatCard>
```

### 4. Add Behavior When Needed

JavaScript only for interactive components:

```javascript
class RefreshButton extends Jqhtml_Component {
  on_ready() {
    this.$.on('click', () => {
      this.refresh_dashboard();
    });
  }

  async refresh_dashboard() {
    // Refresh logic
  }
}
```

## Key Principles

### 1. Semantic Names Over Cryptic Classes

**❌ Bad**:
```html
<div class="d-flex justify-content-between align-items-center mb-3">
```

**✅ Good**:
```blade
<HeaderRowWithActions>
```

### 2. Logical Structure Over Visual Structure

**❌ Bad**:
```html
<div class="row">
  <div class="col-md-8">
    <div class="card">
```

**✅ Good**:
```blade
<ContentArea>
  <PrimarySection>
    <ContentCard>
```

### 3. Component Composition Over Class Composition

**❌ Bad**:
```html
<div class="card shadow-sm border-0 rounded-lg">
  <div class="card-header bg-primary text-white">
    <h5 class="card-title mb-0">
```

**✅ Good**:
```blade
<Card>
  <CardHeader $theme="primary">
    <CardTitle>
```

### 4. Parameters Over Classes

**❌ Bad**:
```html
<div class="alert alert-success">
<div class="alert alert-danger">
<div class="alert alert-warning">
```

**✅ Good**:
```blade
<Alert $type="success">
<Alert $type="danger">
<Alert $type="warning">
```

## The Success Test

There is one test for whether a page has been designed semantically:

**The page template reads like the main routine of a well-engineered program - a sequence of named concepts - and the page's own stylesheet is close to empty.**

```blade
<InvoicePage>
  <PageLayout>
    <Slot:main>
      <InvoiceHeader $invoice_id=this.args.invoice_id />
      <InvoiceLineItems $invoice_id=this.args.invoice_id />
      <InvoiceTotals $invoice_id=this.args.invoice_id />
    </Slot:main>

    <Slot:sidebar>
      <InvoiceStatusPanel $invoice_id=this.args.invoice_id />
      <PaymentHistory $invoice_id=this.args.invoice_id />
    </Slot:sidebar>
  </PageLayout>
</InvoicePage>
```

A page template that weaves markup, styling hooks and business logic together across
hundreds of lines is a symptom of skipping this discipline, not a natural consequence of
a complex page. If a page needs its own stylesheet, each surviving rule should carry a
comment saying why it could not live inside a component.

The permanent reason is cohesion. When one concept renders through one component
everywhere, four things follow at once:

1. **A consistent vocabulary** - the same tag renders the same concept on every page
2. **Separation of concerns by layer** - layout, chrome, and content vocabulary are distinct
3. **One unit type per data shape** - the application has a countable set of components
4. **Reskinning readiness** - change one component's styles, every page follows

## Argument Rules: Content Goes Inside the Tag

**Anything the user reads belongs in `content()` or a named slot. Never in an attribute.**

Arguments carry *data* that the component formats itself (`$user_id`, `$status_id`,
`$count`) and *behavioral flags* (`$variant`, `$size`, `$removable`).

```blade
{{-- ❌ Authored content trapped as a dead string --}}
<SummaryTile $label="Open Tasks" $count=12 />

{{-- ✅ Content is content --}}
<SummaryTile $count=12>Open Tasks</SummaryTile>
```

`$label="Open Tasks"` is exactly as wrong as `$title="Dashboard"`. Even a single word
today may need markup tomorrow - an icon, an abbreviation, a nested component - and an
attribute can hold none of those.

**HTML inside an argument string is always a defect:**

```blade
{{-- ❌ Never --}}
<SectionCard $title="<i class='bi bi-star'></i> Rating">

{{-- ✅ The icon is content, so it goes in a slot --}}
<SectionCard>
  <Slot:title><i class="bi bi-star"></i> Rating</Slot:title>
  <Slot:body>...</Slot:body>
</SectionCard>
```

### Dual-Channel Chrome (the one allowance)

Structural wrappers - page layouts, section cards, form fields - may accept a
plain-string `$title`/`$label` argument for convenience, **provided they also expose a
matching slot that wins when present**:

```jqhtml
<Define:SectionCard class="section-card">
  <div class="section-card-title">
    <%= content('title') || this.args.title %>
  </div>
  <div class="section-card-body">
    <%= content('body') %>
  </div>
</Define:SectionCard>
```

`content('name')` returns an empty string when the caller supplied no such slot, so the
`||` fallback resolves to the argument only when the slot is absent.

Plain text - the argument is fine. Any markup, icon, emphasis or nested component - the
slot, always.

### Variants Are Arguments, Validated Loudly

A component should reject an unknown variant rather than render unstyled:

```javascript
class Alert extends Jqhtml_Component {
  on_create() {
    this.args.variant = this.args.variant || 'info';

    const allowed = ['info', 'success', 'warning', 'danger'];
    if (!allowed.includes(this.args.variant)) {
      throw new Error(`Alert: unknown $variant "${this.args.variant}"`);
    }
  }
}
```

A fail-loud error at development time beats a silently unstyled banner in production.

## Spacing and Containment Ownership

This is the mechanism that keeps page templates free of spacing markup. Three rules.

### R1 - Blocks carry no outer margins

A component styles its interior only. Containers own the gaps between their children.

```scss
// ❌ SectionCard pushes on whatever is above it
.SectionCard { margin-bottom: 1.5rem; }

// ✅ The container owns the rhythm
.PageLayout {
    .main { display: flex; flex-direction: column; gap: var(--section-gap); }
}
```

A component that carries no outer margin can be dropped into any container without
bringing spacing assumptions with it, and no page ever needs a negative-margin clawback
to undo one.

### R2 - Containers pad; content never pushes back

When a block must run edge-to-edge inside a padded container, that is a flag on the
**container**, not CSS inside the child cancelling its parent's padding.

```blade
{{-- ❌ Child fights the parent from inside --}}
<SectionCard>
  <Slot:body>
    <div style="margin: -1rem;"><RecordTable /></div>
  </Slot:body>
</SectionCard>

{{-- ✅ The container is told to drop its padding --}}
<SectionCard $bleed=true>
  <Slot:body>
    <RecordTable />
  </Slot:body>
</SectionCard>
```

### R3 - One variable per gap relationship, defined once

Name gaps by the relationship they express, not by their size, and define each in exactly
one place:

```scss
:root {
    --section-gap:   1.5rem;  // between stacked sections
    --card-padding:  1rem;    // inside a card body
    --column-gutter: 2rem;    // between layout columns
}
```

Never write `var(--section-gap, 1.5rem)`. An inline fallback hides an undefined variable
instead of letting it fail visibly.

## The Empty-State Mandate

Every region that can render zero children renders a named empty-state component - never
bare "no results" text, never nothing at all.

```jqhtml
<Define:ActivityFeed>
  <% if (this.data.events.length === 0) { %>
    <EmptyState $icon="clock">
      No activity yet. Events appear here once this account is used.
    </EmptyState>
  <% } else { %>
    <% for (let event of this.data.events) { %>
      <ActivityRow $event=event />
    <% } %>
  <% } %>
</Define:ActivityFeed>
```

A single empty cell gets its own component too, so "no value" looks the same everywhere:

```jqhtml
<td>
  <% if (record.assignee) { %>
    <UserLink $user_id=record.assignee.id />
  <% } else { %>
    <EmptyValue />
  <% } %>
</td>
```

**Every count must agree with what its list actually renders.** A tab labelled
"Invoices (4)" above a list of three is a bug. Building empty states is usually what
surfaces it.

## Real-World Example: Form Design

### Traditional Way

```html
<form class="needs-validation" novalidate>
  <div class="row mb-3">
    <label class="col-sm-3 col-form-label">Username</label>
    <div class="col-sm-9">
      <input type="text" class="form-control" id="username">
      <div class="invalid-feedback">Please enter username</div>
    </div>
  </div>

  <div class="row mb-3">
    <label class="col-sm-3 col-form-label">Email</label>
    <div class="col-sm-9">
      <input type="email" class="form-control" id="email">
      <div class="invalid-feedback">Please enter valid email</div>
    </div>
  </div>

  <div class="row mb-3">
    <div class="col-sm-9 offset-sm-3">
      <button type="submit" class="btn btn-primary">Submit</button>
      <button type="reset" class="btn btn-secondary">Reset</button>
    </div>
  </div>
</form>
```

### JQHTML Way

```blade
<FormComponent>
  <FormRow>
    <FormLabel>Username</FormLabel>
    <TextInput $sid="username" $required=true />
  </FormRow>

  <FormRow>
    <FormLabel>Email</FormLabel>
    <EmailInput $sid="email" $required=true />
  </FormRow>

  <FormActions>
    <SubmitButton>Submit</SubmitButton>
    <ResetButton>Reset</ResetButton>
  </FormActions>
</FormComponent>
```

**Component definitions** (once):

```jqhtml
<Define:FormComponent tag="form" class="needs-validation">
  <%= content() %>
</Define:FormComponent>

<Define:FormRow class="row mb-3">
  <div class="col-sm-3">
    <%= content('label') %>
  </div>
  <div class="col-sm-9">
    <%= content() %>
  </div>
</Define:FormRow>

<Define:TextInput tag="input" class="form-control">
  <!-- input element -->
</Define:TextInput>
```

## Benefits of This Approach

### For Mechanical Thinkers

- **Think in concepts, not classes**: "I need a user selector" not "I need a div with form-select and validation"
- **Focus on logic**: What components do I need, not how do I style them
- **Compose naturally**: Nest components like nesting concepts
- **No CSS knowledge needed**: Until you define the component template

### For Teams

- **Shared vocabulary**: "Add a NoticeBlock here" - everyone knows what that means
- **Consistency**: All NoticeBlocks look the same project-wide
- **Maintainability**: Change NoticeBlock template once, affects everywhere
- **Onboarding**: New devs understand semantic names immediately

### For Projects

- **Rapid prototyping**: Scaffold entire pages without worrying about styling
- **Iterative refinement**: Add visual polish incrementally
- **Component library**: Build up reusable components over time
- **Refactoring safety**: Change implementation without changing usage

## Building a Component Library

### Start with Common Patterns

Identify repeating visual patterns in your project:

1. **Page Structure**: Page, PageHeader, PageBody, PageFooter
2. **Layout**: ContentArea, Sidebar, TwoColumnLayout
3. **Content**: Card, Panel, SectionHeader
4. **Forms**: FormRow, TextInput, SelectInput, SubmitButton
5. **Navigation**: Breadcrumbs, TabNavigation, DropdownMenu
6. **Feedback**: Alert, NoticeBlock, SuccessMessage, ErrorMessage
7. **Data Display**: TableComponent, StatsGrid, StatCard
8. **User Elements**: UserProfile_Mini, AvatarComponent

### Extract from Existing Pages

Look at current HTML and identify logical elements:

```html
<!-- This pattern repeats -->
<div class="card mb-3">
  <div class="card-body">
    <h5 class="card-title">Title</h5>
    <p class="card-text">Content</p>
  </div>
</div>

<!-- Becomes component -->
<Card>
  <CardTitle>Title</CardTitle>
  Content
</Card>
```

### Progressive Enhancement

1. **Extract markup**: Copy visual markup to component template
2. **Add parameters**: Make dynamic with `$` attributes
3. **Add behavior**: JavaScript for interactive components
4. **Refine styling**: Adjust CSS for component class name

## The Vision

**End goal**: Entire application written in semantic, composable components.

Pages become readable, maintainable documents:

```jqhtml
<DashboardLayout>
  <DashboardSidebar>
    <UserProfile_Widget />
    <NavigationMenu />
    <QuickActions />
  </DashboardSidebar>

  <DashboardMain>
    <PageHeader>
      <PageTitle><%= this.data.page_title %></PageTitle>
      <ActionButtons>
        <CreateNewButton />
        <FilterButton />
      </ActionButtons>
    </PageHeader>

    <StatsSummary>
      <StatCard $label="Active" $value=this.data.active_count />
      <StatCard $label="Pending" $value=this.data.pending_count />
    </StatsSummary>

    <DataTable>
      <% for (let item of this.data.items) { %>
        <TableRow $item_id=item.id>
          <TableCell><%= item.name %></TableCell>
          <TableCell>
            <StatusBadge $status=item.status />
          </TableCell>
        </TableRow>
      <% } %>
    </DataTable>
  </DashboardMain>
</DashboardLayout>
```

**No cryptic classes. No mental mapping. Just readable, composable concepts.**

## This is JQHTML

Not a framework for CSS experts. A system for **developers who want to build interfaces by composing logical concepts**, leaving visual details for later (or for designers).

**Write the structure you want. Define the details when ready. Reuse everywhere.**
