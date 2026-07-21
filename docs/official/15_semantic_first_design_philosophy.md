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
    <StatCard $label="Revenue" $value="$45,230" />
    <StatCard $label="Orders" $value="1,234" />
    <StatCard $label="Customers" $value="567" />
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
    <h5 class="card-title"><%= this.args.label %></h5>
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
