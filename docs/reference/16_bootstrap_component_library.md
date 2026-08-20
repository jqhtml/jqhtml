# Bootstrap Component Library for JQHTML

> **Last Updated**: October 7, 2025
> **Status**: This document has not been reviewed since the November 2025 documentation updates. Content may be outdated. A comprehensive audit and update is pending.

## Overview

This document catalogs reusable JQHTML components extracted from existing Bootstrap 5 pages in the RSX application. These components follow the semantic-first design philosophy - human-readable names that describe **what** they are, not **how** they look.

**Goal**: Build pages using semantic components, maintaining consistent styling project-wide.

**Source Pages Analyzed**:
- `demo_advanced.blade.php`
- `demo/sections/*.blade.php` (typography, cards, buttons, forms, alerts, tables, modals)
- `login/login_index.blade.php`
- `frontend/clients/frontend_clients.blade.php`
- `frontend/client_view/frontend_client_view.blade.php`
- `frontend/client_edit/frontend_client_edit.blade.php`
- `frontend/account/frontend_account.blade.php`

---

## Page Structure Components

### Page

**Purpose**: Main page container

**Markup**:
```jqhtml
<Define:Page class="page-container">
  <%= content() %>
</Define:Page>
```

**Usage**:
```blade
<Page>
  <!-- Page content -->
</Page>
```

---

### PageHeader

**Purpose**: Page title area with optional actions

**Markup**:
```jqhtml
<Define:PageHeader class="mb-4">
  <div class="d-flex justify-content-between align-items-center">
    <div>
      <%= content() %>
    </div>
    <div class="text-end">
      <%= content('actions') %>
    </div>
  </div>
</Define:PageHeader>
```

**Usage**:
```blade
<PageHeader>
  <h1 class="display-5 mb-2">Page Title</h1>
  <p class="lead">Subtitle text</p>

  <Slot:actions>
    <a href="/back" class="btn btn-outline-secondary">Back</a>
  </Slot:actions>
</PageHeader>
```

---

### PageTitle

**Purpose**: Main page heading

**Markup**:
```jqhtml
<Define:PageTitle tag="h1" class="h2 mb-1">
  <%= content() %>
</Define:PageTitle>
```

**Usage**:
```blade
<PageTitle>Clients</PageTitle>
```

---

### PageSubtitle

**Purpose**: Descriptive text below page title

**Markup**:
```jqhtml
<Define:PageSubtitle tag="p" class="text-muted mb-0">
  <%= content() %>
</Define:PageSubtitle>
```

**Usage**:
```blade
<PageSubtitle>Manage your client database</PageSubtitle>
```

---

## Layout Components

### TwoColumnLayout

**Purpose**: Main content with sidebar

**Markup**:
```jqhtml
<Define:TwoColumnLayout class="layout-with-sidebar">
  <aside class="layout-sidebar">
    <%= content('sidebar') %>
  </aside>
  <main class="layout-main">
    <%= content() %>
  </main>
</Define:TwoColumnLayout>
```

**Usage**:
```blade
<TwoColumnLayout>
  <Slot:sidebar>
    <!-- Sidebar content -->
  </Slot:sidebar>

  <!-- Main content -->
</TwoColumnLayout>
```

---

### ContentRow

**Purpose**: Bootstrap row layout

**Markup**:
```jqhtml
<Define:ContentRow class="row">
  <%= content() %>
</Define:ContentRow>
```

---

### ContentColumn

**Purpose**: Responsive column

**Markup**:
```jqhtml
<Define:ContentColumn>
  <% this.$.addClass('col-md-' + (this.args.size || '12')) %>
  <%= content() %>
</Define:ContentColumn>
```

**Usage**:
```blade
<ContentRow>
  <ContentColumn $size="6">
    Left column
  </ContentColumn>
  <ContentColumn $size="6">
    Right column
  </ContentColumn>
</ContentRow>
```

---

## Card Components

### Card

**Purpose**: Bootstrap card container

**Markup**:
```jqhtml
<Define:Card class="card">
  <%= content() %>
</Define:Card>
```

**Usage**:
```blade
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

---

### CardHeader

**Purpose**: Card top section

**Markup**:
```jqhtml
<Define:CardHeader class="card-header">
  <% if (this.args.theme) { this.$.addClass('bg-' + this.args.theme); } %>
  <%= content() %>
</Define:CardHeader>
```

**Usage**:
```blade
<CardHeader>Header Text</CardHeader>
<CardHeader $theme="light">Light Header</CardHeader>
```

---

### CardBody

**Purpose**: Card main content area

**Markup**:
```jqhtml
<Define:CardBody class="card-body">
  <%= content() %>
</Define:CardBody>
```

---

### CardFooter

**Purpose**: Card bottom section

**Markup**:
```jqhtml
<Define:CardFooter class="card-footer text-muted">
  <%= content() %>
</Define:CardFooter>
```

---

### CardTitle

**Purpose**: Card heading

**Markup**:
```jqhtml
<Define:CardTitle tag="h5" class="card-title">
  <% if (this.args.no_margin) { this.$.addClass('mb-0'); } %>
  <%= content() %>
</Define:CardTitle>
```

**Usage**:
```blade
<CardTitle>Card Title</CardTitle>
<CardTitle $no_margin=true>No Margin Title</CardTitle>
```

---

### CardText

**Purpose**: Card paragraph text

**Markup**:
```jqhtml
<Define:CardText tag="p" class="card-text">
  <%= content() %>
</Define:CardText>
```

---

### CardImage

**Purpose**: Card image element

**Markup**:
```jqhtml
<Define:CardImage tag="img" class="card-img-top">
  <!-- Self-closing, attributes set via args -->
</Define:CardImage>
```

**JavaScript**:
```javascript
class CardImage extends Jqhtml_Component {
  on_render() {
    this.$.attr('src', this.args.src || '');
    this.$.attr('alt', this.args.alt || '');
  }
}
```

**Usage**:
```blade
<CardImage $src="https://example.com/image.jpg" $alt="Description" />
```

---

### HorizontalCard

**Purpose**: Card with image on left, content on right

**Markup**:
```jqhtml
<Define:HorizontalCard class="card">
  <div class="row g-0">
    <div class="col-md-4">
      <%= content('image') %>
    </div>
    <div class="col-md-8">
      <div class="card-body">
        <%= content() %>
      </div>
    </div>
  </div>
</Define:HorizontalCard>
```

**Usage**:
```blade
<HorizontalCard>
  <Slot:image>
    <img src="..." class="img-fluid rounded-start">
  </Slot:image>

  <CardTitle>Title</CardTitle>
  <CardText>Content</CardText>
</HorizontalCard>
```

---

## Alert Components

### Alert

**Purpose**: Contextual feedback message

**Markup**:
```jqhtml
<Define:Alert class="alert" role="alert">
  <% this.$.addClass('alert-' + (this.args.type || 'primary')) %>
  <%= content() %>
</Define:Alert>
```

**Usage**:
```blade
<Alert $type="success">Operation successful!</Alert>
<Alert $type="danger">An error occurred</Alert>
<Alert $type="warning">Warning message</Alert>
<Alert $type="info">Informational message</Alert>
```

---

### AlertDismissible

**Purpose**: Alert with close button

**Markup**:
```jqhtml
<Define:AlertDismissible class="alert alert-dismissible fade show" role="alert">
  <% this.$.addClass('alert-' + (this.args.type || 'primary')) %>
  <%= content() %>
  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</Define:AlertDismissible>
```

**Usage**:
```blade
<AlertDismissible $type="warning">
  <strong>Warning!</strong> Check these fields.
</AlertDismissible>
```

---

### AlertWithIcon

**Purpose**: Alert with icon on left

**Markup**:
```jqhtml
<Define:AlertWithIcon class="alert d-flex align-items-center" role="alert">
  <% this.$.addClass('alert-' + (this.args.type || 'primary')) %>
  <i class="bi bi-<%= this.args.icon || 'info-circle' %> me-2"></i>
  <div>
    <%= content() %>
  </div>
</Define:AlertWithIcon>
```

**Usage**:
```blade
<AlertWithIcon $type="success" $icon="check-circle">
  Your changes have been saved
</AlertWithIcon>
```

---

### NoticeBlock

**Purpose**: Informational notice (semantic alias for Alert)

**Markup**:
```jqhtml
<Define:NoticeBlock class="alert alert-info" role="alert">
  <%= content() %>
</Define:NoticeBlock>
```

**Usage**:
```blade
<NoticeBlock>
  This page is wicked cool
</NoticeBlock>
```

---

### RouteInfoAlert

**Purpose**: Display current controller/action info

**Markup**:
```jqhtml
<Define:RouteInfoAlert class="alert alert-info">
  <strong>Current Route:</strong>
  <code><%= this.args.controller || 'None' %></code>
  ::
  <code><%= this.args.action || 'None' %></code>
</Define:RouteInfoAlert>
```

**Usage**:
```blade
<RouteInfoAlert
  $controller="{{ Rsx::get_current_controller() }}"
  $action="{{ Rsx::get_current_action() }}"
/>
```

---

## Form Components

### FormComponent

**Purpose**: Form container

**Markup**:
```jqhtml
<Define:FormComponent tag="form">
  <% if (this.args.classes) { this.$.addClass(this.args.classes); } %>
  <%= content() %>
</Define:FormComponent>
```

**Usage**:
```blade
<FormComponent>
  <FormRow>
    <!-- Form fields -->
  </FormRow>
</FormComponent>
```

---

### FormRow

**Purpose**: Form field row with label and input

**Markup**:
```jqhtml
<Define:FormRow class="mb-3">
  <%= content() %>
</Define:FormRow>
```

**Usage**:
```blade
<FormRow>
  <FormLabel $for="email">Email Address</FormLabel>
  <TextInput $sid="email" $required=true />
</FormRow>
```

---

### FormLabel

**Purpose**: Form input label

**Markup**:
```jqhtml
<Define:FormLabel tag="label" class="form-label">
  <%= content() %>
</Define:FormLabel>
```

**JavaScript**:
```javascript
class FormLabel extends Jqhtml_Component {
  on_render() {
    if (this.args.for) {
      this.$.attr('for', this.args.for);
    }
  }
}
```

**Usage**:
```blade
<FormLabel $for="username">Username</FormLabel>
```

---

### TextInput

**Purpose**: Text input field

**Markup**:
```jqhtml
<Define:TextInput tag="input" class="form-control">
  <!-- Self-closing -->
</Define:TextInput>
```

**JavaScript**:
```javascript
class TextInput extends Jqhtml_Component {
  on_render() {
    this.$.attr('type', 'text');
    this.$.attr('id', this.args.id || '');
    this.$.attr('placeholder', this.args.placeholder || '');

    if (this.args.required) {
      this.$.attr('required', 'required');
    }

    if (this.args.autofocus) {
      this.$.attr('autofocus', 'autofocus');
    }
  }
}
```

**Usage**:
```blade
<TextInput $sid="username" $placeholder="Enter username" $required=true />
```

---

### EmailInput

**Purpose**: Email input field

**Markup/JavaScript**: Same as TextInput but `type="email"`

---

### PasswordInput

**Purpose**: Password input field

**Markup/JavaScript**: Same as TextInput but `type="password"`

---

### TextareaInput

**Purpose**: Multi-line text input

**Markup**:
```jqhtml
<Define:TextareaInput tag="textarea" class="form-control">
  <%= this.args.value || '' %>
</Define:TextareaInput>
```

**JavaScript**:
```javascript
class TextareaInput extends Jqhtml_Component {
  on_render() {
    this.$.attr('id', this.args.id || '');
    this.$.attr('rows', this.args.rows || '3');
  }
}
```

**Usage**:
```blade
<TextareaInput $sid="description" $rows="5" />
```

---

### SelectInput

**Purpose**: Dropdown select field

**Markup**:
```jqhtml
<Define:SelectInput tag="select" class="form-select">
  <%= content() %>
</Define:SelectInput>
```

**Usage**:
```blade
<SelectInput $sid="country">
  <option value="">Choose...</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</SelectInput>
```

---

### CheckboxInput

**Purpose**: Checkbox with label

**Markup**:
```jqhtml
<Define:CheckboxInput class="mb-3 form-check">
  <input type="checkbox" class="form-check-input" $sid="checkbox">
  <label class="form-check-label" $sid="label">
    <%= content() %>
  </label>
</Define:CheckboxInput>
```

**JavaScript**:
```javascript
class CheckboxInput extends Jqhtml_Component {
  on_render() {
    this.$sid('checkbox').attr('id', this.args.id || '');
    this.$sid('label').attr('for', this.args.id || '');
  }
}
```

**Usage**:
```blade
<CheckboxInput $sid="terms">
  I agree to the terms
</CheckboxInput>
```

---

### FormHelpText

**Purpose**: Help text below input

**Markup**:
```jqhtml
<Define:FormHelpText class="form-text">
  <%= content() %>
</Define:FormHelpText>
```

**Usage**:
```blade
<FormHelpText>We'll never share your email</FormHelpText>
```

---

### InputGroup

**Purpose**: Input with prefix/suffix

**Markup**:
```jqhtml
<Define:InputGroup class="input-group mb-3">
  <% if (this.args.prefix) { %>
    <span class="input-group-text"><%= this.args.prefix %></span>
  <% } %>

  <%= content() %>

  <% if (this.args.suffix) { %>
    <span class="input-group-text"><%= this.args.suffix %></span>
  <% } %>
</Define:InputGroup>
```

**Usage**:
```blade
<InputGroup $prefix="@">
  <TextInput $placeholder="Username" />
</InputGroup>

<InputGroup $prefix="$" $suffix=".00">
  <TextInput $placeholder="Amount" />
</InputGroup>
```

---

### FloatingLabelInput

**Purpose**: Input with floating label

**Markup**:
```jqhtml
<Define:FloatingLabelInput class="form-floating mb-3">
  <%= content('input') %>
  <label $sid="label"><%= this.args.label %></label>
</Define:FloatingLabelInput>
```

**JavaScript**:
```javascript
class FloatingLabelInput extends Jqhtml_Component {
  on_render() {
    const input_id = this.args.input_id || '';
    this.$sid('label').attr('for', input_id);
  }
}
```

**Usage**:
```blade
<FloatingLabelInput $label="Email address" $input_id="floatingInput">
  <Slot:input>
    <TextInput $sid="floatingInput" $placeholder="name@example.com" />
  </Slot:input>
</FloatingLabelInput>
```

---

## Button Components

### Button

**Purpose**: Standard button

**Markup**:
```jqhtml
<Define:Button tag="button" class="btn">
  <%
    const variant = this.args.variant || 'primary';
    this.$.addClass(this.args.outline ? 'btn-outline-' + variant : 'btn-' + variant);
    if (this.args.size) { this.$.addClass('btn-' + this.args.size); }
  %>
  <% if (this.args.icon) { %>
    <i class="bi bi-<%= this.args.icon %> <%= content() ? 'me-2' : '' %>"></i>
  <% } %>
  <%= content() %>
</Define:Button>
```

**JavaScript**:
```javascript
class Button extends Jqhtml_Component {
  on_render() {
    this.$.attr('type', this.args.type || 'button');

    if (this.args.disabled) {
      this.$.attr('disabled', 'disabled');
    }
  }
}
```

**Usage**:
```blade
<Button $variant="primary">Click Me</Button>
<Button $variant="success" $icon="check">Save</Button>
<Button $variant="danger" $outline=true>Cancel</Button>
<Button $size="lg">Large Button</Button>
<Button $disabled=true>Disabled</Button>
```

---

### SubmitButton

**Purpose**: Form submit button

**Markup**:
```jqhtml
<Define:SubmitButton tag="button" class="btn btn-primary">
  <%= content() || 'Submit' %>
</Define:SubmitButton>
```

**JavaScript**:
```javascript
class SubmitButton extends Jqhtml_Component {
  on_render() {
    this.$.attr('type', 'submit');
  }
}
```

---

### ButtonGroup

**Purpose**: Group of buttons

**Markup**:
```jqhtml
<Define:ButtonGroup class="btn-group" role="group">
  <%= content() %>
</Define:ButtonGroup>
```

**Usage**:
```blade
<ButtonGroup>
  <Button>Left</Button>
  <Button>Middle</Button>
  <Button>Right</Button>
</ButtonGroup>
```

---

### ButtonWithDropdown

**Purpose**: Button that opens dropdown menu

**Markup**:
```jqhtml
<Define:ButtonWithDropdown class="btn-group">
  <button type="button" class="btn btn-<%= this.args.variant || 'primary' %> dropdown-toggle" data-bs-toggle="dropdown">
    <%= this.args.label %>
  </button>
  <ul class="dropdown-menu">
    <%= content() %>
  </ul>
</Define:ButtonWithDropdown>
```

**Usage**:
```blade
<ButtonWithDropdown $variant="primary" $label="Actions">
  <li><a class="dropdown-item" href="#">Edit</a></li>
  <li><a class="dropdown-item" href="#">Delete</a></li>
  <li><hr class="dropdown-divider"></li>
  <li><a class="dropdown-item" href="#">Archive</a></li>
</ButtonWithDropdown>
```

---

## Navigation Components

### Breadcrumbs

**Purpose**: Navigation breadcrumb trail

**Markup**:
```jqhtml
<Define:Breadcrumbs tag="nav" aria-label="breadcrumb">
  <ol class="breadcrumb">
    <% if (this.args.major_section) { %>
      <li class="breadcrumb-item">
        <% if (this.args.major_section_url) { %>
          <a href="<%= this.args.major_section_url %>"><%= this.args.major_section %></a>
        <% } else { %>
          <%= this.args.major_section %>
        <% } %>
      </li>
    <% } %>

    <% if (this.args.minor_section_title) { %>
      <li class="breadcrumb-item active"><%= this.args.minor_section_title %></li>
    <% } %>
  </ol>
</Define:Breadcrumbs>
```

**Usage**:
```blade
<Breadcrumbs
  $major_section="Pages"
  $major_section_url="/pages"
  $minor_section_title="My Cool Page"
/>
```

---

### NavPagination

**Purpose**: Previous/Next navigation

**Markup**:
```jqhtml
<Define:NavPagination class="d-flex justify-content-between">
  <div>
    <%= content('previous') %>
  </div>
  <div>
    <%= content('next') %>
  </div>
</Define:NavPagination>
```

**Usage**:
```blade
<NavPagination>
  <Slot:previous>
    <a href="/prev" class="btn btn-outline-secondary">
      <i class="bi bi-arrow-left me-2"></i>Previous
    </a>
  </Slot:previous>

  <Slot:next>
    <a href="/next" class="btn btn-primary">
      Next<i class="bi bi-arrow-right ms-2"></i>
    </a>
  </Slot:next>
</NavPagination>
```

---

## Badge Components

### Badge

**Purpose**: Small status label

**Markup**:
```jqhtml
<Define:Badge tag="span" class="badge">
  <% this.$.addClass('bg-' + (this.args.variant || 'primary')) %>
  <%= content() %>
</Define:Badge>
```

**Usage**:
```blade
<Badge $variant="success">Active</Badge>
<Badge $variant="danger">Inactive</Badge>
<Badge $variant="warning">Pending</Badge>
```

---

### BadgeGroup

**Purpose**: Multiple badges together

**Markup**:
```jqhtml
<Define:BadgeGroup class="d-flex gap-2">
  <%= content() %>
</Define:BadgeGroup>
```

**Usage**:
```blade
<BadgeGroup>
  <Badge $variant="primary">Planning: 3</Badge>
  <Badge $variant="warning">Development: 7</Badge>
  <Badge $variant="success">Testing: 12</Badge>
</BadgeGroup>
```

---

## Progress Components

### ProgressBar

**Purpose**: Progress indicator

**Markup**:
```jqhtml
<Define:ProgressBar class="mb-3">
  <label class="form-label"><%= this.args.label %></label>
  <div class="progress" style="height: <%= this.args.height || '20' %>px;">
    <div
      $sid="bar"
      class="progress-bar <%= this.args.striped ? 'progress-bar-striped' : '' %> <%= this.args.animated ? 'progress-bar-animated' : '' %>"
      role="progressbar"
    >
      <%= this.args.value %>%
    </div>
  </div>
  <% if (this.args.show_text) { %>
    <small class="text-muted"><%= this.args.value %>% complete</small>
  <% } %>
</Define:ProgressBar>
```

**JavaScript**:
```javascript
class ProgressBar extends Jqhtml_Component {
  on_render() {
    const value = this.args.value || 0;
    this.$sid('bar')
      .css('width', value + '%')
      .attr('aria-valuenow', value)
      .attr('aria-valuemin', '0')
      .attr('aria-valuemax', '100');
  }
}
```

**Usage**:
```blade
<ProgressBar
  $label="Project Progress"
  $value="65"
  $striped=true
  $animated=true
  $show_text=true
/>
```

---

## Table Components

### DataTable

**Purpose**: Responsive data table

**Markup**:
```jqhtml
<Define:DataTable class="card">
  <% if (this.args.title) { %>
    <div class="card-header bg-light">
      <div class="d-flex justify-content-between align-items-center">
        <h5 class="mb-0"><%= this.args.title %></h5>
        <% if (this.args.subtitle) { %>
          <small class="text-muted"><%= this.args.subtitle %></small>
        <% } %>
      </div>
    </div>
  <% } %>

  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <%= content() %>
      </table>
    </div>
  </div>
</Define:DataTable>
```

**Usage**:
```blade
<DataTable $title="Client List" $subtitle="Showing 10 of 248">
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>John Doe</td>
      <td><Badge $variant="success">Active</Badge></td>
    </tr>
  </tbody>
</DataTable>
```

---

## Sidebar Components

### Sidebar

**Purpose**: Sidebar navigation/actions area

**Markup**:
```jqhtml
<Define:Sidebar tag="nav" class="sidebar">
  <%= content() %>
</Define:Sidebar>
```

---

### SidebarHeader

**Purpose**: Sidebar title section

**Markup**:
```jqhtml
<Define:SidebarHeader class="sidebar-header">
  <h5 class="mb-0"><%= this.args.title %></h5>
  <% if (this.args.subtitle) { %>
    <small class="text-muted"><%= this.args.subtitle %></small>
  <% } %>
</Define:SidebarHeader>
```

**Usage**:
```blade
<SidebarHeader $title="Client Actions" $subtitle="Quick Actions" />
```

---

### SidebarActions

**Purpose**: Action buttons in sidebar

**Markup**:
```jqhtml
<Define:SidebarActions class="sidebar-actions p-3">
  <div class="d-grid gap-2">
    <%= content() %>
  </div>
</Define:SidebarActions>
```

**Usage**:
```blade
<SidebarActions>
  <Button $variant="primary" $icon="plus-circle">New Client</Button>
  <Button $variant="success" $outline=true $icon="download">Export</Button>
</SidebarActions>
```

---

### QuickStats

**Purpose**: Sidebar statistics display

**Markup**:
```jqhtml
<Define:QuickStats>
  <h6 class="text-muted mb-2"><%= this.args.title || 'Quick Stats' %></h6>
  <div class="small">
    <%= content() %>
  </div>
</Define:QuickStats>
```

**Usage**:
```blade
<QuickStats>
  <StatRow $label="Total Clients" $value="248" />
  <StatRow $label="Active" $value="192" $color="success" />
  <StatRow $label="Inactive" $value="43" $color="warning" />
</QuickStats>
```

---

### StatRow

**Purpose**: Single stat in QuickStats

**Markup**:
```jqhtml
<Define:StatRow class="d-flex justify-content-between">
  <% if (!this.args.last) { this.$.addClass('mb-1'); } %>
  <span><%= this.args.label %>:</span>
  <strong class="<%= this.args.color ? 'text-' + this.args.color : '' %>">
    <%= this.args.value %>
  </strong>
</Define:StatRow>
```

---

## Search Components

### SearchBar

**Purpose**: Search input with button

**Markup**:
```jqhtml
<Define:SearchBar class="d-flex gap-2">
  <input
    type="search"
    class="form-control"
    $sid="search_input"
    placeholder="<%= this.args.placeholder || 'Search...' %>"
    style="width: <%= this.args.width || '250' %>px;"
  >
  <button class="btn btn-outline-secondary" $sid="search_button">
    <i class="bi bi-search"></i>
  </button>
</Define:SearchBar>
```

**JavaScript**:
```javascript
class SearchBar extends Jqhtml_Component {
  on_ready() {
    this.$sid('search_button').on('click', () => {
      this.perform_search();
    });

    this.$sid('search_input').on('keypress', (e) => {
      if (e.which === 13) { // Enter key
        this.perform_search();
      }
    });
  }

  perform_search() {
    const query = this.$sid('search_input').val();
    this.$.trigger('search', [query]);
  }
}
```

**Usage**:
```blade
<SearchBar $placeholder="Search clients..." />
```

---

## Login Components

### LoginHeader

**Purpose**: Login page welcome message

**Markup**:
```jqhtml
<Define:LoginHeader class="login-header">
  <h2><%= this.args.title || 'Welcome Back' %></h2>
  <p><%= this.args.subtitle || 'Please login to your account' %></p>
</Define:LoginHeader>
```

**Usage**:
```blade
<LoginHeader />
<LoginHeader $title="Sign In" $subtitle="Enter your credentials" />
```

---

## Typography Components

### DisplayHeading

**Purpose**: Large display heading

**Markup**:
```jqhtml
<Define:DisplayHeading tag="h1">
  <% this.$.addClass('display-' + (this.args.size || '4')) %>
  <%= content() %>
</Define:DisplayHeading>
```

**Usage**:
```blade
<DisplayHeading $size="4">Large Title</DisplayHeading>
```

---

### LeadParagraph

**Purpose**: Emphasized lead paragraph

**Markup**:
```jqhtml
<Define:LeadParagraph tag="p" class="lead">
  <%= content() %>
</Define:LeadParagraph>
```

---

### Blockquote

**Purpose**: Styled quotation

**Markup**:
```jqhtml
<Define:Blockquote tag="blockquote" class="blockquote">
  <p><%= content() %></p>
  <% if (this.args.author || this.args.source) { %>
    <footer class="blockquote-footer">
      <%= this.args.author %>
      <% if (this.args.source) { %>
        in <cite title="<%= this.args.source %>"><%= this.args.source %></cite>
      <% } %>
    </footer>
  <% } %>
</Define:Blockquote>
```

**Usage**:
```blade
<Blockquote $author="Someone famous" $source="Source Title">
  A well-known quote, contained in a blockquote element.
</Blockquote>
```

---

## Component Library Summary

### Page Structure (9 components)
- Page, PageHeader, PageTitle, PageSubtitle
- TwoColumnLayout, ContentRow, ContentColumn
- Sidebar, SidebarHeader, SidebarActions

### Cards (9 components)
- Card, CardHeader, CardBody, CardFooter
- CardTitle, CardText, CardImage
- HorizontalCard

### Alerts (5 components)
- Alert, AlertDismissible, AlertWithIcon
- NoticeBlock, RouteInfoAlert

### Forms (15 components)
- FormComponent, FormRow, FormLabel, FormHelpText
- TextInput, EmailInput, PasswordInput, TextareaInput, SelectInput
- CheckboxInput, InputGroup, FloatingLabelInput

### Buttons (5 components)
- Button, SubmitButton, ButtonGroup, ButtonWithDropdown

### Navigation (2 components)
- Breadcrumbs, NavPagination

### Badges (2 components)
- Badge, BadgeGroup

### Progress (1 component)
- ProgressBar

### Tables (1 component)
- DataTable

### Search (1 component)
- SearchBar

### Stats (2 components)
- QuickStats, StatRow

### Login (1 component)
- LoginHeader

### Typography (3 components)
- DisplayHeading, LeadParagraph, Blockquote

**Total: 56 components**

---

## Usage Philosophy

**Start with semantic markup**:
```blade
<Page>
  <PageHeader>
    <PageTitle>Clients</PageTitle>
    <PageSubtitle>Manage your database</PageSubtitle>
  </PageHeader>

  <SearchBar $placeholder="Search clients..." />

  <DataTable $title="Client List">
    <!-- Table content -->
  </DataTable>
</Page>
```

**Visual details in component definitions** - define once, reuse everywhere.

**Consistent styling** - all PageTitles look the same, all Cards follow same pattern.

**Easy to read, easy to maintain** - semantic names make intent clear.

---

## Detail View Components

### DetailField

**Purpose**: Label-value pair for displaying read-only information

**Markup**:
```jqhtml
<Define:DetailField class="mb-3">
  <label class="text-muted small"><%= this.args.label %></label>
  <p class="mb-0 <%= this.args.bold ? 'fw-bold' : '' %>">
    <%= content() %>
  </p>
</Define:DetailField>
```

**Usage**:
```blade
<DetailField $label="Client ID" $bold=true>#12345</DetailField>
<DetailField $label="Email">client@example.com</DetailField>
```

---

### DetailField_Row

**Purpose**: Two-column layout for detail fields

**Markup**:
```jqhtml
<Define:DetailField_Row class="row mb-3">
  <%= content() %>
</Define:DetailField_Row>
```

**Usage**:
```blade
<DetailField_Row>
  <div class="col-sm-6">
    <DetailField $label="Email">client@example.com</DetailField>
  </div>
  <div class="col-sm-6">
    <DetailField $label="Phone">(555) 123-4567</DetailField>
  </div>
</DetailField_Row>
```

---

### DetailsSection

**Purpose**: Card containing grouped detail fields

**Markup**:
```jqhtml
<Define:DetailsSection class="card mb-4">
  <div class="card-header">
    <h5 class="mb-0"><%= this.args.title %></h5>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:DetailsSection>
```

**Usage**:
```blade
<DetailsSection $title="Primary Details">
  <DetailField_Row>
    <!-- Fields -->
  </DetailField_Row>
</DetailsSection>
```

---

### ClientSidebar

**Purpose**: Action sidebar for detail/edit pages

**Markup**:
```jqhtml
<Define:ClientSidebar tag="nav" class="client-sidebar">
  <div class="sidebar-header">
    <h5 class="mb-0"><%= this.args.title || 'Actions' %></h5>
    <small class="text-muted"><%= this.args.subtitle || 'Quick Actions' %></small>
  </div>

  <div class="sidebar-actions p-3">
    <%= content() %>
  </div>
</Define:ClientSidebar>
```

**Usage**:
```blade
<ClientSidebar $title="Client Actions" $subtitle="Quick Actions">
  <ButtonStack>
    <Button $icon="pencil">Edit Client</Button>
    <Button $icon="trash" $theme="danger">Delete Client</Button>
  </ButtonStack>
</ClientSidebar>
```

---

### ButtonStack

**Purpose**: Vertical stack of buttons with consistent spacing

**Markup**:
```jqhtml
<Define:ButtonStack class="d-grid gap-2 mb-3">
  <%= content() %>
</Define:ButtonStack>
```

**Usage**:
```blade
<ButtonStack>
  <button class="btn btn-primary">Primary Action</button>
  <button class="btn btn-outline-secondary">Secondary Action</button>
</ButtonStack>
```

---

### SidebarQuickLinks

**Purpose**: List group of navigation links in sidebar

**Markup**:
```jqhtml
<Define:SidebarQuickLinks>
  <h6 class="text-muted mb-2"><%= this.args.title || 'Quick Links' %></h6>
  <div class="list-group list-group-flush small">
    <%= content() %>
  </div>
</Define:SidebarQuickLinks>
```

**Usage**:
```blade
<SidebarQuickLinks $title="Quick Links">
  <a href="#" class="list-group-item list-group-item-action">
    <i class="bi bi-arrow-left me-2"></i>Back to List
  </a>
  <a href="#" class="list-group-item list-group-item-action">
    <i class="bi bi-file-earmark me-2"></i>View Documents
  </a>
</SidebarQuickLinks>
```

---

### TwoColumnLayout

**Purpose**: Responsive two-column layout (main content + sidebar)

**Markup**:
```jqhtml
<Define:TwoColumnLayout class="row">
  <div class="col-lg-8">
    <%= content() %>
  </div>
  <div class="col-lg-4">
    <%= content('sidebar') %>
  </div>
</Define:TwoColumnLayout>
```

**Usage**:
```blade
<TwoColumnLayout>
  <DetailsSection $title="Primary Details">
    <!-- Main content -->
  </DetailsSection>

  <Slot:sidebar>
    <Widget $title="Stats">
      <!-- Sidebar widgets -->
    </Widget>
  </Slot:sidebar>
</TwoColumnLayout>
```

---

### Widget

**Purpose**: Sidebar information card

**Markup**:
```jqhtml
<Define:Widget class="card mb-3">
  <div class="card-header <%= this.args.header_class || '' %>">
    <h6 class="mb-0"><%= this.args.title %></h6>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:Widget>
```

**Usage**:
```blade
<Widget $title="Company Stats" $header_class="bg-primary text-white">
  <div class="mb-2">
    <small class="text-muted">Annual Revenue</small>
    <p class="mb-0 fs-5 fw-bold">$2.5M</p>
  </div>
</Widget>
```

---

### TimelineWidget

**Purpose**: Timeline information widget

**Markup**:
```jqhtml
<Define:TimelineWidget class="card mb-3">
  <div class="card-header">
    <h6 class="mb-0"><%= this.args.title || 'Timeline' %></h6>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:TimelineWidget>
```

**Usage**:
```blade
<TimelineWidget>
  <div class="mb-3">
    <small class="text-muted">Created</small>
    <p class="mb-0">Jan 15, 2025</p>
  </div>
  <div>
    <small class="text-muted">Last Contact</small>
    <p class="mb-0">Oct 5, 2025</p>
  </div>
</TimelineWidget>
```

---

### ActivityListWidget

**Purpose**: Recent activity feed widget

**Markup**:
```jqhtml
<Define:ActivityListWidget class="card mb-3">
  <div class="card-header">
    <h6 class="mb-0"><%= this.args.title || 'Recent Activity' %></h6>
  </div>
  <div class="list-group list-group-flush small">
    <%= content() %>
  </div>
</Define:ActivityListWidget>
```

**Usage**:
```blade
<ActivityListWidget>
  <ActivityItem $title="Email sent" $timestamp="2 days ago">
    Project proposal discussion
  </ActivityItem>
  <ActivityItem $title="Meeting scheduled" $timestamp="5 days ago">
    Quarterly review meeting
  </ActivityItem>
</ActivityListWidget>
```

---

### ActivityItem

**Purpose**: Single activity entry

**Markup**:
```jqhtml
<Define:ActivityItem class="list-group-item">
  <div class="d-flex w-100 justify-content-between">
    <strong><%= this.args.title %></strong>
    <small><%= this.args.timestamp %></small>
  </div>
  <p class="mb-0 text-muted"><%= content() %></p>
</Define:ActivityItem>
```

**Usage**:
```blade
<ActivityItem $title="Email sent" $timestamp="2 days ago">
  Project proposal discussion
</ActivityItem>
```

---

### TagsWidget

**Purpose**: Display tag collection

**Markup**:
```jqhtml
<Define:TagsWidget class="card">
  <div class="card-header">
    <h6 class="mb-0"><%= this.args.title || 'Tags' %></h6>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:TagsWidget>
```

**Usage**:
```blade
<TagsWidget>
  <span class="badge bg-secondary me-1 mb-1">VIP Client</span>
  <span class="badge bg-secondary me-1 mb-1">Enterprise</span>
  <span class="badge bg-secondary me-1 mb-1">Cloud Services</span>
</TagsWidget>
```

---

## Form Layout Components

### FormSectionCard

**Purpose**: Card containing grouped form fields

**Markup**:
```jqhtml
<Define:FormSectionCard class="card mb-4">
  <div class="card-header">
    <h5 class="mb-0"><%= this.args.title %></h5>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:FormSectionCard>
```

**Usage**:
```blade
<form>
  <FormSectionCard $title="Basic Information">
    <FormRow_Two_Column>
      <!-- Fields -->
    </FormRow_Two_Column>
  </FormSectionCard>
</form>
```

---

### FormRow_Two_Column

**Purpose**: Two-column responsive form row

**Markup**:
```jqhtml
<Define:FormRow_Two_Column class="row">
  <%= content() %>
</Define:FormRow_Two_Column>
```

**Usage**:
```blade
<FormRow_Two_Column>
  <div class="col-md-6 mb-3">
    <TextInput $label="First Name" $name="first_name" $required=true />
  </div>
  <div class="col-md-6 mb-3">
    <TextInput $label="Last Name" $name="last_name" $required=true />
  </div>
</FormRow_Two_Column>
```

---

### RequiredIndicator

**Purpose**: Red asterisk for required fields

**Markup**:
```jqhtml
<Define:RequiredIndicator tag="span" class="text-danger">*</Define:RequiredIndicator>
```

**Usage**:
```blade
<label>Email <RequiredIndicator /></label>
```

---

### FormHelpText

**Purpose**: Small helper text below form fields

**Markup**:
```jqhtml
<Define:FormHelpText tag="small" class="form-text text-muted">
  <%= content() %>
</Define:FormHelpText>
```

**Usage**:
```blade
<textarea class="form-control" name="notes"></textarea>
<FormHelpText>Internal notes (not visible to client)</FormHelpText>
```

---

### FormActions_Card

**Purpose**: Bottom form action buttons in card

**Markup**:
```jqhtml
<Define:FormActions_Card class="card">
  <div class="card-body">
    <div class="d-flex justify-content-end gap-2">
      <%= content() %>
    </div>
  </div>
</Define:FormActions_Card>
```

**Usage**:
```blade
<FormActions_Card>
  <a href="/back" class="btn btn-outline-secondary">Cancel</a>
  <button type="submit" class="btn btn-primary">Save Changes</button>
</FormActions_Card>
```

---

### SidebarFormTips

**Purpose**: Helpful tips in sidebar for forms

**Markup**:
```jqhtml
<Define:SidebarFormTips>
  <hr>
  <h6 class="text-muted mb-2">Form Tips</h6>
  <div class="small text-muted">
    <ul class="ps-3">
      <%= content() %>
    </ul>
  </div>
</Define:SidebarFormTips>
```

**Usage**:
```blade
<SidebarFormTips>
  <li class="mb-2">Fields marked with <RequiredIndicator /> are required</li>
  <li class="mb-2">Email must be unique</li>
  <li>Phone format: (555) 123-4567</li>
</SidebarFormTips>
```

---

## Account Management Components

### SubscriptionOverviewCard

**Purpose**: Current subscription plan display

**Markup**:
```jqhtml
<Define:SubscriptionOverviewCard class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0"><%= this.args.title || 'Current Subscription' %></h5>
    <span class="badge bg-<%= this.args.status_color || 'success' %>">
      <%= this.args.status || 'Active' %>
    </span>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:SubscriptionOverviewCard>
```

**Usage**:
```blade
<SubscriptionOverviewCard $status="Active" $status_color="success">
  <div class="row">
    <div class="col-md-6">
      <h6 class="text-muted">Plan</h6>
      <h4>Professional</h4>
      <p class="text-muted">$49/month • Billed monthly</p>
    </div>
  </div>
</SubscriptionOverviewCard>
```

---

### UsageMetric

**Purpose**: Single usage progress bar

**Markup**:
```jqhtml
<Define:UsageMetric class="usage-metric">
  <div class="d-flex justify-content-between mb-1">
    <small class="text-muted"><%= this.args.label %></small>
    <small><%= this.args.used %> / <%= this.args.total %></small>
  </div>
  <div class="progress" style="height: <%= this.args.height || '8' %>px;">
    <div class="progress-bar" style="width: <%= this.args.percentage %>%"></div>
  </div>
</Define:UsageMetric>
```

**Usage**:
```blade
<UsageMetric
  $label="API Calls"
  $used="8,421"
  $total="10,000"
  $percentage=84
/>
```

---

### UsageMetricsGrid

**Purpose**: Grid of usage metrics

**Markup**:
```jqhtml
<Define:UsageMetricsGrid>
  <h6 class="mb-3"><%= this.args.title || 'Usage This Period' %></h6>
  <div class="row g-3">
    <%= content() %>
  </div>
</Define:UsageMetricsGrid>
```

**Usage**:
```blade
<UsageMetricsGrid>
  <div class="col-md-4">
    <UsageMetric $label="API Calls" $used="8,421" $total="10,000" $percentage=84 />
  </div>
  <div class="col-md-4">
    <UsageMetric $label="Storage" $used="4.2 GB" $total="10 GB" $percentage=42 />
  </div>
</UsageMetricsGrid>
```

---

### PaymentMethodCard

**Purpose**: Display single payment method

**Markup**:
```jqhtml
<Define:PaymentMethodCard class="payment-method mb-3 p-3 border rounded">
  <div class="row align-items-center">
    <div class="col-auto">
      <i class="bi bi-<%= this.args.icon || 'credit-card' %> fs-3"></i>
    </div>
    <div class="col">
      <%= content() %>
    </div>
    <div class="col-auto">
      <%= content('actions') %>
    </div>
  </div>
</Define:PaymentMethodCard>
```

**Usage**:
```blade
<PaymentMethodCard $icon="credit-card">
  <div class="d-flex align-items-center">
    <strong>Visa ending in 4242</strong>
    <span class="badge bg-primary ms-2">Default</span>
  </div>
  <small class="text-muted">Expires 12/2027</small>

  <Slot:actions>
    <button class="btn btn-sm btn-outline-secondary">Edit</button>
    <button class="btn btn-sm btn-outline-danger ms-1">Remove</button>
  </Slot:actions>
</PaymentMethodCard>
```

---

### BillingAddressCard

**Purpose**: Display billing address

**Markup**:
```jqhtml
<Define:BillingAddressCard class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0"><%= this.args.title || 'Billing Address' %></h5>
    <button class="btn btn-sm btn-link">Edit</button>
  </div>
  <div class="card-body">
    <address>
      <%= content() %>
    </address>
  </div>
</Define:BillingAddressCard>
```

**Usage**:
```blade
<BillingAddressCard>
  <strong>Acme Corporation</strong><br>
  123 Business Ave<br>
  San Francisco, CA 94107<br>
  United States
</BillingAddressCard>
```

---

### InvoiceTable

**Purpose**: Billing history table

**Markup**:
```jqhtml
<Define:InvoiceTable class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0"><%= this.args.title || 'Billing History' %></h5>
    <div>
      <%= content('actions') %>
    </div>
  </div>
  <div class="card-body">
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <%= content() %>
        </tbody>
      </table>
    </div>
  </div>
</Define:InvoiceTable>
```

**Usage**:
```blade
<InvoiceTable>
  <tr>
    <td><a href="#">#INV-2025-010</a></td>
    <td>Sep 15, 2025</td>
    <td>Professional Plan - Monthly</td>
    <td>$49.00</td>
    <td><span class="badge bg-success">Paid</span></td>
    <td>
      <button class="btn btn-sm btn-link">Download</button>
    </td>
  </tr>
</InvoiceTable>
```

---

### TeamMemberTable

**Purpose**: Team members list with roles

**Markup**:
```jqhtml
<Define:TeamMemberTable class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="mb-0"><%= this.args.title || 'Team Members' %></h5>
    <button class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#inviteModal">
      <i class="bi bi-person-plus"></i> Invite Member
    </button>
  </div>
  <div class="card-body">
    <%= content('alert') %>

    <div class="table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <%= content() %>
        </tbody>
      </table>
    </div>
  </div>
</Define:TeamMemberTable>
```

**Usage**:
```blade
<TeamMemberTable>
  <Slot:alert>
    <div class="alert alert-info">
      You're using 3 of 5 seats. <a href="#">Upgrade plan</a> to add more.
    </div>
  </Slot:alert>

  <TeamMemberRow
    $name="John Smith"
    $email="john@example.com"
    $role="Owner"
    $status="Active"
    $last_active="2 hours ago"
  />
</TeamMemberTable>
```

---

### TeamMemberRow

**Purpose**: Single team member row with avatar

**Markup**:
```jqhtml
<Define:TeamMemberRow tag="tr">
  <td>
    <div class="d-flex align-items-center">
      <div class="avatar avatar-sm me-2">
        <span class="avatar-initial rounded-circle bg-<%= this.args.avatar_color || 'primary' %>">
          <%= this.args.initials %>
        </span>
      </div>
      <div>
        <div><%= this.args.name %></div>
        <small class="text-muted"><%= this.args.email %></small>
      </div>
    </div>
  </td>
  <td>
    <% if (this.args.role_editable) { %>
      <select class="form-select form-select-sm" style="width: auto;">
        <option>Admin</option>
        <option>Editor</option>
        <option>Viewer</option>
      </select>
    <% } else { %>
      <span class="badge bg-dark"><%= this.args.role %></span>
    <% } %>
  </td>
  <td><span class="badge bg-<%= this.args.status_color || 'success' %>"><%= this.args.status %></span></td>
  <td><%= this.args.last_active %></td>
  <td>
    <%= content() %>
  </td>
</Define:TeamMemberRow>
```

**Usage**:
```blade
<TeamMemberRow
  $name="John Smith"
  $email="john@example.com"
  $initials="JS"
  $avatar_color="primary"
  $role="Owner"
  $status="Active"
  $status_color="success"
  $last_active="2 hours ago"
>
  -
</TeamMemberRow>
```

---

### PlanComparisonCard

**Purpose**: Pricing plan card in modal

**Markup**:
```jqhtml
<Define:PlanComparisonCard class="card h-100">
  <% if (this.args.highlighted) { this.$.addClass('border-primary'); } %>
  <div class="card-body text-center">
    <% if (this.args.badge) { %>
      <span class="badge bg-<%= this.args.badge_color || 'primary' %>"><%= this.args.badge %></span>
    <% } %>
    <h5 class="<%= this.args.badge ? 'mt-2' : '' %>"><%= this.args.plan_name %></h5>
    <h2>$<%= this.args.price %><small class="text-muted">/mo</small></h2>
    <ul class="list-unstyled mt-3">
      <%= content() %>
    </ul>
    <button class="btn btn-<%= this.args.button_style || 'outline-primary' %> w-100 mt-3"
            <% if (this.args.disabled) { %>disabled<% } %>>
      <%= this.args.button_text || 'Select Plan' %>
    </button>
  </div>
</Define:PlanComparisonCard>
```

**Usage**:
```blade
<div class="row g-3">
  <div class="col-md-4">
    <PlanComparisonCard
      $plan_name="Professional"
      $price="49"
      $badge="Current Plan"
      $button_text="Current Plan"
      $button_style="primary"
      $highlighted=true
      $disabled=true
    >
      <li><strong>10,000 API calls</strong></li>
      <li><strong>10 GB storage</strong></li>
      <li><strong>5 team members</strong></li>
    </PlanComparisonCard>
  </div>
</div>
```

---

## Modal Components

### ModalPaymentForm

**Purpose**: Add payment method modal

**Markup**:
```jqhtml
<Define:ModalPaymentForm>
  <div class="modal fade" id="<%= this.args.modal_id || 'addPaymentModal' %>" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><%= this.args.title || 'Add Payment Method' %></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <form>
            <div class="mb-3">
              <label class="form-label">Card Number</label>
              <input type="text" class="form-control" placeholder="1234 5678 9012 3456">
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Expiry Date</label>
                <input type="text" class="form-control" placeholder="MM/YY">
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label">CVV</label>
                <input type="text" class="form-control" placeholder="123">
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Cardholder Name</label>
              <input type="text" class="form-control" placeholder="John Smith">
            </div>
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="makeDefault">
              <label class="form-check-label" for="makeDefault">
                Make this my default payment method
              </label>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary">Add Payment Method</button>
        </div>
      </div>
    </div>
  </div>
</Define:ModalPaymentForm>
```

**Usage**:
```blade
<ModalPaymentForm $modal_id="addPaymentModal" />
```

---

### ModalInviteMember

**Purpose**: Invite team member modal

**Markup**:
```jqhtml
<Define:ModalInviteMember>
  <div class="modal fade" id="<%= this.args.modal_id || 'inviteModal' %>" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><%= this.args.title || 'Invite Team Member' %></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <form>
            <div class="mb-3">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-control" placeholder="colleague@example.com">
            </div>
            <div class="mb-3">
              <label class="form-label">Role</label>
              <select class="form-select">
                <option>Admin - Full access to all features</option>
                <option selected>Editor - Can create and edit content</option>
                <option>Viewer - Read-only access</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">Personal Message (Optional)</label>
              <textarea class="form-control" rows="3" placeholder="Hey! Join our team workspace..."></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary">Send Invitation</button>
        </div>
      </div>
    </div>
  </div>
</Define:ModalInviteMember>
```

**Usage**:
```blade
<ModalInviteMember $modal_id="inviteModal" />
```

---

## Component Summary

### Total Components: 87

**Page Structure** (9): Page, PageHeader, PageTitle, PageSubtitle, PageBody, PageFooter, Sidebar, StickyFooter, ContentArea

**Cards** (9): Card, CardHeader, CardBody, CardFooter, CardTitle, HorizontalCard, CardWithIcon, InfoCard, StatCard

**Alerts** (5): Alert, AlertDismissible, NoticeBlock, SuccessMessage, ErrorMessage

**Forms** (15): FormComponent, FormRow, FormLabel, TextInput, EmailInput, PasswordInput, TelInput, TextareaInput, SelectInput, CheckboxInput, RadioButton, SubmitButton, ResetButton, FileUpload_Input, DateInput

**Buttons** (5): Button, SubmitButton, ButtonGroup, ButtonToolbar, IconButton

**Navigation** (2): Breadcrumbs, NavPagination

**Badges** (2): Badge, BadgeGroup

**Progress** (1): ProgressBar

**Tables** (1): DataTable

**Search** (1): SearchBar

**Stats** (2): QuickStats, StatRow

**Login** (1): LoginHeader

**Typography** (3): DisplayHeading, LeadParagraph, Blockquote

**Detail Views** (13): DetailField, DetailField_Row, DetailsSection, ClientSidebar, ButtonStack, SidebarQuickLinks, TwoColumnLayout, Widget, TimelineWidget, ActivityListWidget, ActivityItem, TagsWidget, DetailRow

**Form Layout** (7): FormSectionCard, FormRow_Two_Column, RequiredIndicator, FormHelpText, FormActions_Card, SidebarFormTips, FormFieldGroup

**Account Management** (10): SubscriptionOverviewCard, UsageMetric, UsageMetricsGrid, PaymentMethodCard, BillingAddressCard, InvoiceTable, TeamMemberTable, TeamMemberRow, PlanComparisonCard, QuickActions_Card

**Modals** (2): ModalPaymentForm, ModalInviteMember

---

## Complete Page Example

```blade
<Page>
  <PageHeader>
    <PageTitle>Client Details</PageTitle>
    <PageSubtitle>View and manage client information</PageSubtitle>
  </PageHeader>

  <div class="client-view-with-sidebar">
    <ClientSidebar $title="Client Actions">
      <ButtonStack>
        <Button $icon="pencil" $theme="primary">Edit Client</Button>
        <Button $icon="trash" $theme="danger">Delete Client</Button>
      </ButtonStack>

      <SidebarQuickLinks>
        <a href="/clients" class="list-group-item list-group-item-action">
          <i class="bi bi-arrow-left me-2"></i>Back to List
        </a>
      </SidebarQuickLinks>
    </ClientSidebar>

    <div class="client-main">
      <TwoColumnLayout>
        <DetailsSection $title="Primary Details">
          <DetailField_Row>
            <div class="col-sm-6">
              <DetailField $label="Email">client@example.com</DetailField>
            </div>
            <div class="col-sm-6">
              <DetailField $label="Phone">(555) 123-4567</DetailField>
            </div>
          </DetailField_Row>
        </DetailsSection>

        <Slot:sidebar>
          <Widget $title="Company Stats" $header_class="bg-primary text-white">
            <div class="mb-2">
              <small class="text-muted">Annual Revenue</small>
              <p class="mb-0 fs-5 fw-bold">$2.5M</p>
            </div>
          </Widget>

          <TagsWidget>
            <span class="badge bg-secondary me-1 mb-1">VIP Client</span>
            <span class="badge bg-secondary me-1 mb-1">Enterprise</span>
          </TagsWidget>
        </Slot:sidebar>
      </TwoColumnLayout>
    </div>
  </div>
</Page>
```
