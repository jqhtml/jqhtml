# Semantic Iterative Design Methodology

## The Core Problem JQHTML Solves

**The Designer's Dilemma**: Not everyone thinks visually. Many developers think mechanically, logically, structurally - they understand systems, data flow, and component relationships far better than they understand color theory, spacing hierarchies, or visual design principles.

Traditional HTML/CSS/Bootstrap development forces mechanical thinkers to operate in visual space from line one. Before you can write a single line of markup, you need to know: Is this a `container-fluid` or just `container`? Do I need `d-flex justify-content-between align-items-center` or `row`? Should this be `col-md-8` or `col-lg-9`? What's the difference between `mb-3` and `mb-4`?

**This is cognitive overload for mechanical thinkers.**

## The JQHTML Philosophy: Think Logically, Style Later

JQHTML inverts the traditional workflow:

1. **Think about structure first** - What logical elements does this page need?
2. **Write semantic markup** - Name things what they ARE, not how they look
3. **See it working immediately** - Even undefined components render
4. **Add visual details incrementally** - Define component templates when ready
5. **Reuse everywhere** - One definition, infinite uses

### The Mechanical Thinker's Workflow

Here's how a mechanical thinker actually approaches building a page:

> "I need a page that shows client details. It needs a title, some info about the client, a place to show their activity, and action buttons to edit or delete them. There should probably be a sidebar with quick stats."

**Traditional approach forces you to immediately think**:
- "Okay, so I need a `.container-fluid` wrapper..."
- "The sidebar is `col-md-4` and the main content is `col-md-8`..."
- "Each detail field needs `.mb-3` and a `.text-muted` label..."
- "The action buttons go in a `.d-grid .gap-2` stack..."

**JQHTML lets you write what you just thought**:

```blade
<Page>
  <PageTitle>Client Details</PageTitle>

  <ClientDetails>
    <ClientInfo />
    <ClientActivity />
  </ClientDetails>

  <ClientSidebar>
    <ClientActions>
      <EditButton />
      <DeleteButton />
    </ClientActions>
    <ClientStats />
  </ClientSidebar>
</Page>
```

**This works immediately.** Every undefined component renders as a div with its name as a class. You can see the page structure, navigate it, test the logic.

## Real Example: The Boilerplate Workflow

Here's the actual example from the JQHTML creator:

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

**Analysis of this approach**:

1. **Readable** - Any developer can understand this page structure in 10 seconds
2. **Logical hierarchy** - Nesting shows relationships, not visual layout
3. **Self-documenting** - Component names explain purpose
4. **Works immediately** - Page renders with basic divs and classes
5. **Incrementally refinable** - Add visual polish to components one at a time

### The Creator's Perspective

> "I'm not much of a designer and I think much more mechanically than visually, so UI has always been a struggle for me, which is why I designed JQHTML. The goal here is I want to composite concepts in my HTML documents, rather than actual HTML elements which I have to give cryptic class names and maintain the mental mapping of what all the class names mean both for their multitude of CSS rules and magic identifiers that backing jQuery code uses to access them."

This is the **design philosophy in a nutshell**:

- **Composite concepts, not elements**
- **Eliminate mental mapping overhead**
- **Semantic names over cryptic classes**
- **Mechanical thinking over visual thinking**

## When Something Becomes a Component

This is the critical question: When do you extract markup into a component vs just writing HTML?

### Rule 1: Repetition Signals Component Opportunity

If you write the same markup pattern twice, consider a component:

```blade
{{-- ❌ Repetition without components --}}
<div class="card mb-3">
  <div class="card-header">
    <h5 class="mb-0">Basic Info</h5>
  </div>
  <div class="card-body">
    <!-- content -->
  </div>
</div>

<div class="card mb-3">
  <div class="card-header">
    <h5 class="mb-0">Contact Info</h5>
  </div>
  <div class="card-body">
    <!-- content -->
  </div>
</div>

{{-- ✅ Component extracted --}}
<InfoSection $title="Basic Info">
  <!-- content -->
</InfoSection>

<InfoSection $title="Contact Info">
  <!-- content -->
</InfoSection>
```

### Rule 2: Logical Meaning Suggests Component

If markup represents a **concept** rather than just visual styling, make it a component:

```blade
{{-- ❌ Visual markup without semantic meaning --}}
<div class="d-flex justify-content-between align-items-center mb-3">
  <div>
    <h3>John Smith</h3>
    <p class="text-muted">john@example.com</p>
  </div>
  <span class="badge bg-success">Active</span>
</div>

{{-- ✅ Semantic component name --}}
<UserHeader $name="John Smith" $email="john@example.com" $status="Active" />
```

The second version is **self-documenting**. You know it's a user header without reading the markup.

### Rule 3: Configurable Behavior Requires Component

If the markup needs to change based on parameters, make it a component:

```blade
{{-- ✅ Component with behavior --}}
<Alert $type="success">
  Changes saved!
</Alert>

<Alert $type="danger">
  Error: Invalid input
</Alert>
```

The component handles the Bootstrap class logic internally:

```jqhtml
<Define:Alert class="alert alert-<%= this.args.type || 'primary' %>" role="alert">
  <%= content() %>
</Define:Alert>
```

### Rule 4: Keep Simple Things Simple

**Don't componentize everything**. Some markup is just markup:

```blade
{{-- ✅ Fine as-is --}}
<p class="lead">Welcome to our application!</p>

{{-- ❌ Over-engineered --}}
<LeadParagraph>Welcome to our application!</LeadParagraph>
```

Unless you have **many** lead paragraphs throughout your app and want to ensure they all look consistent, just use the HTML.

### Rule 5: Domain-Specific Concepts Always Become Components

If something is specific to your application domain, it should be a component:

```blade
{{-- ✅ Domain-specific components --}}
<InvoiceHeader $invoice_id="INV-2025-001" />
<ProductCard $product_id="123" />
<ShippingStatus $tracking_number="ABC123" />
<PaymentMethodSelector $default="card" />
```

These are **concepts in your business domain**, not just UI elements. They deserve semantic names.

## The Cognitive Load Reduction

### Traditional Bootstrap Approach

```html
<div class="container-fluid">
  <div class="row mb-4">
    <div class="col">
      <h1 class="h3 mb-0">Account Management</h1>
      <nav aria-label="breadcrumb" class="mt-2">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Dashboard</a></li>
          <li class="breadcrumb-item active">Account</li>
        </ol>
      </nav>
    </div>
  </div>

  <div class="row mb-4">
    <div class="col-lg-8">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Current Subscription</h5>
          <span class="badge bg-success">Active</span>
        </div>
        <div class="card-body">
          <!-- Complex nested divs continue... -->
        </div>
      </div>
    </div>
  </div>
</div>
```

**Mental load**:
- Must remember what `container-fluid` does vs `container`
- Must know Bootstrap's 12-column grid system
- Must understand flexbox classes (`d-flex`, `justify-content-between`)
- Must maintain mental map of spacing utilities (`mb-4`, `mt-2`, `mb-0`)
- Must know semantic HTML for accessibility (`aria-label`, etc.)
- Visual structure obscures logical structure

### JQHTML Semantic Approach

```blade
<Page>
  <PageHeader>
    <PageTitle>Account Management</PageTitle>
    <Breadcrumbs>
      <BreadcrumbItem $url="/">Dashboard</BreadcrumbItem>
      <BreadcrumbItem $active=true>Account</BreadcrumbItem>
    </Breadcrumbs>
  </PageHeader>

  <TwoColumnLayout>
    <SubscriptionCard $status="Active">
      <!-- Content -->
    </SubscriptionCard>

    <Slot:sidebar>
      <QuickActions />
    </Slot:sidebar>
  </TwoColumnLayout>
</Page>
```

**Mental load**:
- Understand page structure (Page → Header → Title/Breadcrumbs → Layout → Content)
- Know what data each component needs (`$status`, `$url`, etc.)
- That's it

The visual implementation details live in component definitions, not in your page logic.

## The Iterative Refinement Process

### Stage 1: Scaffold with Undefined Components

Start with pure logic:

```blade
<Dashboard>
  <DashboardHeader>
    <DashboardTitle>Sales Overview</DashboardTitle>
    <DateRangeSelector />
  </DashboardHeader>

  <MetricsGrid>
    <MetricCard $label="Revenue" $value="$125,430" />
    <MetricCard $label="Orders" $value="1,234" />
    <MetricCard $label="Customers" $value="567" />
  </MetricsGrid>

  <ChartSection>
    <SalesChart />
    <RevenueChart />
  </ChartSection>
</Dashboard>
```

**This works right now.** Every component renders as:

```html
<div class="Dashboard">
  <div class="DashboardHeader">
    <div class="DashboardTitle">Sales Overview</div>
    <div class="DateRangeSelector"></div>
  </div>
  <!-- etc -->
</div>
```

Add basic CSS targeting class names:

```scss
.Dashboard {
  padding: 2rem;

  .DashboardHeader {
    margin-bottom: 2rem;
  }

  .MetricsGrid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }
}
```

**Page is now styled with zero changes to markup.**

### Stage 2: Define High-Value Components

Identify components that need **behavior** or **complex markup**:

```jqhtml
<Define:MetricCard class="card">
  <div class="card-body text-center">
    <div class="text-muted small"><%= this.args.label %></div>
    <div class="display-4"><%= this.args.value %></div>
  </div>
</Define:MetricCard>
```

```javascript
class SalesChart extends Jqhtml_Component {
  async on_load() {
    this.data = await fetch('/api/sales-data').then(r => r.json());
  }

  on_ready() {
    this.render_chart();
  }

  render_chart() {
    // Chart.js implementation
  }
}
```

### Stage 3: Refine Visual Details

Now that logic works, refine visuals:

```jqhtml
<Define:MetricCard class="card shadow-sm border-0">
  <div class="card-body text-center">
    <div class="text-muted text-uppercase small mb-2">
      <i class="bi bi-<%= this.args.icon %> me-1"></i>
      <%= this.args.label %>
    </div>
    <div class="display-4 fw-bold text-<%= this.args.color || 'primary' %>">
      <%= this.args.value %>
    </div>
    <% if (this.args.change) { %>
      <div class="small <%= this.args.change > 0 ? 'text-success' : 'text-danger' %>">
        <%= this.args.change > 0 ? '↑' : '↓' %>
        <%= Math.abs(this.args.change) %>% vs last period
      </div>
    <% } %>
  </div>
</Define:MetricCard>
```

Usage barely changes:

```blade
<MetricCard
  $label="Revenue"
  $value="$125,430"
  $icon="currency-dollar"
  $change="12.5"
/>
```

### Stage 4: Extract Common Patterns

As you build more pages, extract repeated patterns:

```blade
{{-- Pattern noticed across multiple pages --}}
<div class="d-flex justify-content-between align-items-center mb-4">
  <div>
    <h1>{{ $title }}</h1>
    <p class="text-muted">{{ $subtitle }}</p>
  </div>
  <div>
    {{ $actions }}
  </div>
</div>

{{-- Extract to component --}}
<Define:PageHeader_With_Actions class="mb-4">
  <div class="d-flex justify-content-between align-items-center">
    <div>
      <%= content() %>
    </div>
    <div>
      <%= content('actions') %>
    </div>
  </div>
</Define:PageHeader_With_Actions>
```

Now every page uses:

```blade
<PageHeader_With_Actions>
  <h1>{{ $title }}</h1>
  <p class="text-muted">{{ $subtitle }}</p>

  <Slot:actions>
    <Button $theme="primary">Add New</Button>
  </Slot:actions>
</PageHeader_With_Actions>
```

## Consistency Through Reuse

### The Problem: Subtle Inconsistencies

When you write Bootstrap markup manually, tiny inconsistencies creep in:

```html
{{-- Page 1 --}}
<div class="card mb-3">
  <div class="card-header">
    <h5 class="mb-0">Title</h5>
  </div>
  <!-- ... -->
</div>

{{-- Page 2 --}}
<div class="card mb-4">
  <div class="card-header">
    <h5>Title</h5>
  </div>
  <!-- ... -->
</div>
```

One has `mb-3`, one has `mb-4`. One has `mb-0` on the h5, one doesn't. Over 50 pages, you'll have dozens of variations.

### The Solution: Single Source of Truth

```jqhtml
<Define:SectionCard class="card mb-4">
  <div class="card-header">
    <h5 class="mb-0"><%= this.args.title %></h5>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:SectionCard>
```

Now **every SectionCard looks identical** across your entire application. Change the definition once, update everywhere.

## Component Granularity Guidelines

### Too Granular (Over-componentized)

```blade
<Page>
  <Header>
    <Title>
      <TitleText>Dashboard</TitleText>
    </Title>
    <Subtitle>
      <SubtitleText>Welcome back</SubtitleText>
    </Subtitle>
  </Header>
</Page>
```

This is **too much**. Simple text elements don't need wrapping.

### Good Granularity

```blade
<Page>
  <PageHeader>
    <PageTitle>Dashboard</PageTitle>
    <PageSubtitle>Welcome back</PageSubtitle>
  </PageHeader>
</Page>
```

Components group **logical concepts**, not every HTML tag.

### Granularity Decision Matrix

| Situation | Component? | Why |
|-----------|-----------|-----|
| Repeated markup pattern | ✅ Yes | DRY principle |
| Logical domain concept | ✅ Yes | Self-documenting |
| Needs JavaScript behavior | ✅ Yes | Encapsulation |
| Complex nested structure | ✅ Yes | Abstraction |
| Simple HTML element | ❌ No | Over-engineering |
| One-off custom layout | ❌ No | Not reusable |
| Single line of markup | ❌ No | No value added |

## Naming Conventions That Scale

### Pattern: NounVerb or NounContext

**Good component names**:
- `UserProfile_Card` - Domain noun + context
- `InvoiceStatusBadge` - Domain noun + context
- `ProductImageGallery` - Domain noun + purpose
- `SearchResultsTable` - Purpose + context
- `PaymentMethodSelector` - Domain noun + purpose

**Poor component names**:
- `BlueCard` - Describes appearance, not purpose
- `Container2` - No semantic meaning
- `Widget` - Too vague
- `ComponentX` - Meaningless

### Pattern: Specificity Hierarchy

```
Page                      # Most general
├── DashboardPage        # Page-level specificity
    ├── DashboardHeader  # Section-level specificity
    │   ├── DashboardTitle
    │   └── DashboardActions
    └── DashboardContent # Section-level specificity
        ├── MetricGrid   # Component-level specificity
        │   └── MetricCard
        └── ChartSection
            └── SalesChart
```

Names show hierarchy: `DashboardTitle` clearly belongs to `DashboardHeader`.

## Building a Component Library Organically

### Start Small

Don't try to build a complete component library up-front. Start with:

1. **Page structure** - Page, PageHeader, PageTitle, PageBody, PageFooter
2. **Common layouts** - TwoColumnLayout, ThreeColumnLayout, SidebarLayout
3. **Domain-specific components** - Whatever your app actually uses

### Add Incrementally

As you build pages, notice patterns:

> "Hmm, I've written this card with a colored header three times now..."

Extract it:

```jqhtml
<Define:InfoCard class="card mb-3">
  <div class="card-header bg-<%= this.args.color || 'primary' %> text-white">
    <h6 class="mb-0"><%= this.args.title %></h6>
  </div>
  <div class="card-body">
    <%= content() %>
  </div>
</Define:InfoCard>
```

### Refactor Ruthlessly

When you notice a component is used in multiple ways, consider:

**Option 1: Add parameters**

```jqhtml
<Define:Card class="card <%= this.args.shadow ? 'shadow' : '' %> mb-<%= this.args.spacing || '3' %>">
  <!-- ... -->
</Define:Card>
```

**Option 2: Create variants**

```jqhtml
<Define:Card class="card mb-3">...</Define:Card>
<Define:CardWithShadow class="card shadow mb-3">...</Define:CardWithShadow>
<Define:CardBorderless class="card border-0 mb-3">...</Define:CardBorderless>
```

**Option 3: Split into separate components**

```jqhtml
<Define:InfoCard>...</Define:InfoCard>
<Define:StatCard>...</Define:StatCard>
<Define:ActionCard>...</Define:ActionCard>
```

Choose based on how **semantically different** the use cases are.

## The Team Collaboration Benefit

### Shared Vocabulary

With semantic components, your entire team speaks the same language:

> "Add an Alert component at the top of the page."

Everyone knows what this means. No need to specify Bootstrap classes or markup structure.

### Onboarding New Developers

New developer's first day:

```blade
<Page>
  <PageHeader>
    <PageTitle>New Feature</PageTitle>
  </PageHeader>

  <FormComponent>
    <TextInput $label="Name" $name="name" />
    <SubmitButton>Save</SubmitButton>
  </FormComponent>
</Page>
```

They understand this **immediately**. No Bootstrap documentation needed. No hunting through CSS to figure out what classes to use.

### Design System Enforcement

Your component library **is** your design system:

- All buttons look consistent (same Button component)
- All cards follow the same pattern (same Card components)
- All forms have identical layouts (same Form components)
- All spacing is uniform (defined in component templates)

Developers can't accidentally break the design system by using wrong Bootstrap classes, because they're not using Bootstrap classes at all.

## Implementation Strategy

### Phase 1: Audit Existing Pages

Look at your current application and identify:

1. **Repeated patterns** - What markup do you copy-paste?
2. **Logical groupings** - What sections represent concepts?
3. **Complex structures** - What's hard to remember how to write?

### Phase 2: Extract Top 10 Components

Start with the most commonly used:

1. Page/layout components
2. Card variations
3. Form inputs
4. Buttons
5. Tables/data grids
6. Alerts/notifications
7. Modals
8. Navigation elements
9. User profile displays
10. Status badges

### Phase 3: Refactor One Page Completely

Take a single page and convert it entirely to semantic components:

**Before**:
```html
<div class="container-fluid">
  <div class="row">
    <div class="col-md-8">
      <div class="card">
        <div class="card-body">
          <!-- 50 lines of Bootstrap markup -->
        </div>
      </div>
    </div>
  </div>
</div>
```

**After**:
```blade
<Page>
  <TwoColumnLayout>
    <ContentCard>
      <!-- 5 lines of semantic components -->
    </ContentCard>
  </TwoColumnLayout>
</Page>
```

### Phase 4: Spread to Similar Pages

Use the refactored page as a template for similar pages. The more you reuse, the more valuable the abstraction becomes.

### Phase 5: Build New Features Semantically

All new features start with semantic markup. No raw Bootstrap unless absolutely necessary.

## The Long-Term Vision

### Code That Reads Like Prose

```blade
<InvoicePage>
  <InvoiceHeader $invoice_number="INV-2025-001" />

  <BillingAddresses>
    <BillToAddress $client_id="123" />
    <ShipToAddress $address_id="456" />
  </BillingAddresses>

  <InvoiceItemsTable>
    <% for (let item of invoice.items) { %>
      <InvoiceLineItem $item=item />
    <% } %>
  </InvoiceItemsTable>

  <InvoiceTotals $subtotal=invoice.subtotal $tax=invoice.tax $total=invoice.total />

  <PaymentInstructions />
</InvoicePage>
```

This is **readable by non-developers**. A product manager can understand page structure. A designer can see logical groupings.

### Future-Proof Refactoring

Need to switch from Bootstrap to Tailwind? Change component definitions, not every page:

```jqhtml
{{-- Before: Bootstrap --}}
<Define:Card class="card shadow mb-3">
  <div class="card-body">
    <%= content() %>
  </div>
</Define:Card>

{{-- After: Tailwind --}}
<Define:Card class="bg-white shadow rounded-lg p-6 mb-4">
  <%= content() %>
</Define:Card>
```

**Every page using `<Card>` updates automatically.**

### Design System Evolution

Your component library evolves with your design:

- Add new variants: `<CardWithHoverEffect>`
- Deprecate old patterns: Mark `<OldCard>` as deprecated
- Update globally: Change Button color scheme once
- A/B test designs: Create alternate component versions

## Common Pitfalls to Avoid

### Pitfall 1: Premature Abstraction

Don't create components before you understand the pattern:

❌ **Too Early**:
```blade
{{-- First time writing this markup --}}
<MyNewComponent>
  <!-- Not sure what this should look like yet -->
</MyNewComponent>
```

✅ **Right Time**:
```blade
{{-- Third time writing same pattern --}}
<SectionCard>
  <!-- Pattern is clear now, extract it -->
</SectionCard>
```

### Pitfall 2: Over-Parameterization

Components with 15 parameters are too complex:

❌ **Too Complex**:
```blade
<Card
  $title="Title"
  $shadow=true
  $border=false
  $header_color="blue"
  $spacing="3"
  $rounded=true
  $fade=true
  $dismissible=false
  <!-- 7 more parameters... -->
/>
```

✅ **Right Complexity**:
```blade
<InfoCard $title="Title">
  <!-- Sensible defaults, minimal parameters -->
</InfoCard>
```

### Pitfall 3: Fighting the Framework

JQHTML doesn't replace HTML, it augments it:

❌ **Fighting It**:
```blade
<Paragraph>
  <Text>Some text</Text>
</Paragraph>
```

✅ **Working With It**:
```blade
<InfoCard>
  <p>Some text</p>
</InfoCard>
```

Use components for **concepts**, use HTML for **content**.

## Philosophical Alignment

### For Mechanical Thinkers

If you think in systems, logic, and data flow, JQHTML matches your mental model:

- **Components are functions** - Inputs (args) → Output (markup)
- **Pages are programs** - Composing function calls
- **Nesting is scope** - Logical hierarchy, not visual
- **Names are types** - Self-documenting interfaces

### For The Pragmatist

If you value **shipping over perfecting**, JQHTML accelerates development:

- **Scaffold fast** - Undefined components work immediately
- **Refine later** - Add polish incrementally
- **Reuse aggressively** - Copy component usage, not markup
- **Maintain easily** - Fix once, fixed everywhere

### For The Perfectionist

If you demand **consistency and correctness**, JQHTML enforces standards:

- **Single source of truth** - One component definition
- **Compiler-enforced** - Build fails on missing components (if configured)
- **Type-safe interfaces** - Component args are documented
- **Design system compliance** - Can't break what you can't access

## The Creator's True Intent

From the creator's own words:

> "I want to composite concepts in my HTML documents, rather than actual HTML elements which I have to give cryptic class names and maintain the mental mapping of what all the class names mean both for their multitude of css rules and magic identifiers that backing jquery code uses to access them."

This reveals the **core frustration** JQHTML addresses:

1. **Mental mapping overhead** - Remembering what `.card-header` vs `.card-title` vs `.card-body` all do
2. **Cryptic identifiers** - Classes like `d-flex` and `mb-3` are not self-explanatory
3. **CSS rule complexity** - Hundreds of class combinations to remember
4. **jQuery selector hell** - Finding elements by class name is fragile
5. **Cognitive load** - All this complexity before writing a single line of logic

JQHTML eliminates these pain points by:

1. **Semantic naming** - `<PageHeader>` is self-explanatory
2. **Logical composition** - Nest concepts, not divs
3. **Automatic class generation** - Component name becomes class name
4. **Scoped element access** - `this.$sid('element')` instead of selectors
5. **Minimal cognitive load** - Think about structure, not styling

## Practical Exercise

Take this Bootstrap markup:

```html
<div class="container">
  <div class="row mb-4">
    <div class="col-md-8">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">User Profile</h5>
          <button class="btn btn-sm btn-primary">Edit</button>
        </div>
        <div class="card-body">
          <div class="row mb-3">
            <div class="col-sm-6">
              <label class="text-muted small">Name</label>
              <p class="mb-0">John Smith</p>
            </div>
            <div class="col-sm-6">
              <label class="text-muted small">Email</label>
              <p class="mb-0">john@example.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card">
        <div class="card-body text-center">
          <img src="avatar.jpg" class="rounded-circle mb-3" width="100">
          <h6>John Smith</h6>
          <p class="text-muted small">Member since 2024</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

Convert it to semantic JQHTML:

```blade
<Page>
  <TwoColumnLayout>
    <ProfileInfoCard>
      <DetailField $label="Name" $value="John Smith" />
      <DetailField $label="Email" $value="john@example.com" />

      <Slot:actions>
        <Button $size="sm">Edit</Button>
      </Slot:actions>
    </ProfileInfoCard>

    <Slot:sidebar>
      <ProfileAvatarCard
        $image="avatar.jpg"
        $name="John Smith"
        $member_since="2024"
      />
    </Slot:sidebar>
  </TwoColumnLayout>
</Page>
```

**Result**: 15 lines become 9 lines. Cryptic classes become semantic names. Visual structure becomes logical structure.

---

## Conclusion

JQHTML's semantic iterative design methodology is not about building a component library for its own sake. It's about **reducing cognitive load** so developers can focus on **building features** instead of **remembering class names**.

The workflow is:

1. **Think logically** - What concepts does this page need?
2. **Write semantically** - Name components what they ARE
3. **See it work** - Even undefined components render
4. **Refine incrementally** - Add visual polish when ready
5. **Reuse everywhere** - One definition, infinite uses

This approach works because it **aligns with how mechanical thinkers actually think** about building user interfaces. You're not forced to think visually from line one. You think structurally, logically, systematically - then add the visual layer later.

**That's the JQHTML difference.**
