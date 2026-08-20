# Semantic Design

Semantic design is the practice JQHTML exists to support: composing logical concepts (`<UserCard>`) instead of assembling visual primitives (`<div class="d-flex justify-content-between">`). Earlier chapters covered the mechanics. This chapter covers how to use them well.

## The Test

A page written this way reads like the main routine of a well-engineered program — a sequence of named concepts — and its page-level stylesheet is close to empty.

```jqhtml
<Define:InvoicePage>
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
</Define:InvoicePage>
```

A page template that weaves markup, styling hooks and business logic together across hundreds of lines is a symptom of skipping this discipline, not a natural consequence of a complex page.

The reason is cohesion. When one concept renders through one component everywhere, you get four things at once: a consistent vocabulary, separation of concerns by layer, one place to change each look, and the ability to reskin the application by editing component stylesheets rather than pages.

## Name Things What They Are

The name states the concept, not the appearance.

```jqhtml
<!-- Bad: names describe appearance or nothing at all -->
<BlueCard />
<Container2 />
<Wrapper />
<FlexRow />

<!-- Good: names describe the concept -->
<UserProfileCard />
<InvoiceStatusBadge />
<ShipmentTrackingPanel />
<PaymentMethodSelector />
```

Use a `Noun` or `NounContext` pattern. If the name would have to change when the design changes, it is the wrong name.

Names also carry hierarchy, which makes a large vocabulary navigable:

```
DashboardPage
├── DashboardHeader
│   ├── DashboardTitle
│   └── DashboardActions
└── DashboardMetrics
    └── MetricCard
```

## When a Component Earns Its Existence

Four conditions. Any one of them is enough.

| Condition | Example |
|-----------|---------|
| **Repetition** — the same shape appears in two places | The same bordered section wrapper on two pages |
| **Domain concept** — it means something in your business | `<ShipmentStatus>`, `<InvoiceLineItem>` |
| **Needs configuration** — the markup varies by parameter | `<Alert $variant="danger">` |
| **Complex structure** — nested markup you would otherwise retype | A table row with an avatar, a status chip and an action menu |

And the counter-rule: **never create components for the sake of components.**

```jqhtml
<!-- Over-engineered: a paragraph is a paragraph -->
<LeadParagraph>Welcome to the application.</LeadParagraph>

<!-- Fine as-is -->
<p class="lead">Welcome to the application.</p>
```

Use components for **concepts** and HTML for **content**. `<Paragraph><Text>Some text</Text></Paragraph>` is fighting the framework, not using it.

## The Evidence Bar

Extraction is evidence-driven, never speculative: **two or more live call sites with the same shape.**

Do not build a component in anticipation of a second consumer that does not exist yet. The first time you write a shape you do not yet know which parts are essential and which are incidental to that one page; the second call site is what tells you.

```jqhtml
<!-- First time writing this shape: leave it in the page -->
<div class="summary">
  <h4>Open Tasks</h4>
  <p class="count">12</p>
</div>

<!-- Second page needs the same shape: now extract it -->
<SummaryTile $count=12>Open Tasks</SummaryTile>
```

The one exception is a domain concept with obvious identity — `<InvoiceStatusBadge>` earns its name on sight, because it is a thing in the business, not a shape you noticed.

## Extract, Add a Lever, or Promote

The most common mistake is building a new component when an existing one should have been used or extended.

| Situation | Do this |
|-----------|---------|
| An existing component fits | Use it |
| An existing component almost fits | Add a small **additive lever** — one argument |
| Two or more places hand-roll the same shape | Extract **one** component and converge both onto it |
| A new widget resembles an existing one but means something different | Do **not** merge the domains — extract the display primitive they share |

**A lever's default rendering must be identical to before.** If adding `$removable` to `<TagChip>` shifts a pixel for every existing caller, it is not a lever, it is a rewrite. You carry the regression duty for every existing call site.

```jqhtml
<Define:TagChip tag="span" class="chip">
  <%= content() %>
  <% if (this.args.removable) { %>
    <button $sid="remove" class="chip-remove" aria-label="Remove">&times;</button>
  <% } %>
</Define:TagChip>
```

```jqhtml
<TagChip>Urgent</TagChip>                  <!-- unchanged -->
<TagChip $removable=true>Urgent</TagChip>  <!-- new behavior -->
```

**Do not merge domains.** `<ShipmentStatus>` and `<InvoiceStatus>` may look identical today. They are two concepts that happen to share a shape, and they will diverge. Converge the shape, not the widgets:

```jqhtml
<!-- Shared display primitive -->
<Define:StatusPill tag="span" class="pill">
  <% this.$.addClass('pill-' + this.args.tone); %>
  <%= content() %>
</Define:StatusPill>

<!-- Two domain components, each owning its own mapping -->
<Define:ShipmentStatus>
  <StatusPill $tone=this.args.tone><%= this.data.label %></StatusPill>
</Define:ShipmentStatus>

<Define:InvoiceStatus>
  <StatusPill $tone=this.args.tone><%= this.data.label %></StatusPill>
</Define:InvoiceStatus>
```

**Promotion is the direction of travel.** When a look repeats, promote it from page-local markup to a named component. When two components share a display shape, promote that shape to a shared primitive or an abstract base (see [Template Inheritance](../13-template-inheritance/)). Always toward fewer, better-named, more-reused concepts.

**Wanting a distinctive look is not a reason to skip componentizing.** If a page needs a one-off appearance, the correct output is a named, self-contained component with that appearance — not page-local markup plus page-local CSS.

## Displayed Content Goes Inside the Tag

**Anything the user reads belongs in `content()` or a named slot. Never in an attribute.**

Arguments carry *data* the component formats itself (`$user_id`, `$status_id`, `$count`) and *behavioral flags* (`$variant`, `$size`, `$removable`).

```jqhtml
<!-- Wrong: authored content trapped as a dead string -->
<SummaryTile $label="Open Tasks" $count=12 />

<!-- Right: content is content -->
<SummaryTile $count=12>Open Tasks</SummaryTile>
```

Even a single word today may need markup tomorrow — an icon, an abbreviation, a nested component. An attribute cannot hold any of those.

**HTML inside an argument string is always a defect:**

```jqhtml
<!-- Never -->
<SectionCard $title="<i class='bi bi-star'></i> Rating">

<!-- The icon is content, so it goes in a slot -->
<SectionCard>
  <Slot:title><i class="bi bi-star"></i> Rating</Slot:title>
  <Slot:body>...</Slot:body>
</SectionCard>
```

**The one allowance — dual-channel chrome.** Structural wrappers (page layouts, section cards, form fields) may accept a plain-string `$title`/`$label` argument for convenience, *provided* they also expose a matching slot that wins when present:

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

Plain text — the argument is fine. Any markup, icon, emphasis or nested component — the slot, always.

For the rules on choosing `content()` versus named slots, see [Content & Slots](../09-content-and-slots/).

## Variants Are Arguments, Validated Loudly

Do not encode variants as classes passed in from outside. Encode them as an argument the component validates.

```jqhtml
<!-- Bad: caller has to know the framework's class vocabulary -->
<div class="alert alert-danger">Payment failed</div>

<!-- Good -->
<Alert $variant="danger">Payment failed</Alert>
```

```jqhtml
<Define:Alert class="alert" role="alert">
  <% this.$.addClass('alert-' + this.args.variant); %>
  <%= content() %>
</Define:Alert>
```

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

A loud failure beats a silently unstyled banner shipping to production.

## A Component Owns Its Complete Look

One component, one stylesheet file, wrapped in that component's class. A component never styles another component's class.

```scss
// UserCard.scss
.UserCard {
    padding: var(--card-padding);

    .avatar { width: 64px; }
    .name   { font-weight: 600; }
}
```

```scss
// WRONG — reaching into a child from a parent's stylesheet
.Dashboard {
    .UserCard { background: red; }
}
```

If a parent needs a different-looking child, the child gets a lever (`$compact`, `$variant`), and the child's own file implements it. Full conventions: [Styling with SCSS](../16-styling-with-scss/).

## Spacing and Containment Ownership

This is the mechanism that keeps page templates free of spacing markup. Three rules.

**1. Blocks carry no outer margins.** A component styles its interior only. Containers own the gaps between their children.

```scss
// WRONG — SectionCard pushes on whatever is above it
.SectionCard { margin-bottom: 1.5rem; }

// RIGHT — the container owns the rhythm
.PageLayout {
    .main { display: flex; flex-direction: column; gap: var(--section-gap); }
}
```

The payoff: a component can be dropped into any container without carrying spacing assumptions with it, and no page ever needs a negative-margin clawback to undo one.

**2. Containers pad; content never pushes back.** When a block needs to run edge-to-edge inside a padded container, that is a flag on the *container*, not CSS inside the child cancelling its parent's padding.

```jqhtml
<!-- Wrong: child fights the parent from inside -->
<SectionCard>
  <Slot:title>Recent Orders</Slot:title>
  <Slot:body>
    <div style="margin: -1rem;"><RecordTable /></div>
  </Slot:body>
</SectionCard>

<!-- Right: the container is told to drop its padding -->
<SectionCard $bleed=true>
  <Slot:title>Recent Orders</Slot:title>
  <Slot:body>
    <RecordTable />
  </Slot:body>
</SectionCard>
```

**3. One variable per gap relationship, defined once.** Name gaps by the relationship they express, not by their size, and define each in one place.

```scss
:root {
    --section-gap:   1.5rem;  // between stacked sections
    --card-padding:  1rem;    // inside a card body
    --column-gutter: 2rem;    // between layout columns
}
```

Never write `var(--section-gap, 1.5rem)`. An inline fallback hides an undefined variable instead of letting it fail visibly.

## One Component per Data Shape

Give each data shape exactly one component, so the application has a countable vocabulary: one entity header, one field-display, one record table, one empty state.

Two things that look alike are not necessarily the same concept. A workflow **state**, a **classification**, and a **count** are three different things, and each deserves its own component and its own visual treatment — even though all three are pills:

```jqhtml
<OrderStatus $order_id=order.id />        <!-- state: a value from a workflow -->
<CustomerTier $tier=customer.tier />      <!-- classification: a durable fact -->
<CountPill $count=order.item_count />     <!-- quantity -->
```

Collapsing them into one `<Pill $variant="...">` moves the decision out of the vocabulary and back into every call site — which is the problem you were solving.

## Empty States Are Not Optional

Every region that can render zero children must render a named empty-state component, not bare text and not nothing at all.

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

And every count must agree with what its list actually renders. A tab labelled "Invoices (4)" over a list of three is a bug, and the discipline of building empty states is usually what surfaces it.

## Converting an Existing Page

The unit of work is one page, end to end. Never convert half a page.

**1. Inventory.** Read the page's template, JavaScript and stylesheet completely. Map every region to your existing vocabulary: which component already covers it, which needs a lever, what is genuinely new. List every hand-rolled idiom — raw badge spans, bespoke tab-toggle JavaScript, box-in-box wrappers, inline `style=`, `<hr>` dividers, page-level media queries, sprinkled spacing utilities.

**2. Convert top-down.** Layout first, then sections, then the content vocabulary inside them. Undefined components render immediately, so the page stays viewable the whole way through:

```jqhtml
<!-- Step 1: layout only. Everything below is still undefined; it renders. -->
<Define:AccountPage>
  <PageLayout>
    <Slot:main>
      <SubscriptionSection />
      <BillingHistorySection />
    </Slot:main>
    <Slot:sidebar>
      <AccountSummary />
    </Slot:sidebar>
  </PageLayout>
</Define:AccountPage>
```

**3. Where a seam tempts you to hand-author markup, give the owning component a lever instead.** If three pages "need" the same `<hr>` in the same position, the adjacent component needs a `$divided` argument. Hand-authored seams are a reliable smell for a missing lever.

**4. Reduce the page's own stylesheet to justified survivors,** each with a comment saying why it could not live in a component. Ideally the file ends up empty. Delete inline `style=` attributes and page-level media queries entirely — those belong to components.

**5. Verify with sparse data.** Load the page with an account that has no records, so every empty region proves it renders an empty state. Check every count against what its list renders. Re-check every other page that consumes a component you added a lever to.

## Pitfalls

**Premature abstraction.** Extracting on the first occurrence produces a component shaped by one page's accidents. Wait for the second call site.

**Over-parameterization.** A component with fifteen arguments is a template with extra steps. If `$shadow`, `$border`, `$rounded` and `$header_color` are all needed, you probably have two or three distinct concepts wearing one name.

**Hand-authored seams.** Dividers, spacer divs and one-off wrappers in a page template all point at a missing lever on an adjacent component.

**Naming residue.** When a component is deleted or renamed, rename everything named after it — stylesheet files, argument names, CSS classes. A stale name is worse than no name.

**Fighting the framework.** JQHTML augments HTML, it does not replace it. Components for concepts, HTML for content.

## Next Steps

- [Content & Slots](../09-content-and-slots/) — the mechanics behind the content rule
- [Template Inheritance](../13-template-inheritance/) — abstract bases and shared primitives
- [Styling with SCSS](../16-styling-with-scss/) — the one-file-per-component convention

---

<!-- DOCUMENTATION METADATA (removed in public export) -->
## Documentation Notes

### References
- `docs/reference/15_semantic_first_design_philosophy.md` — semantic-first premise, naming, the four component-creation triggers, argument rules, spacing ownership, empty states, the success test
- `docs/reference/17_semantic_iterative_design_methodology.md` — when a component earns its existence, the evidence bar, extract/lever/promote, granularity, conversion workflow, pitfalls
- `docs/reference/19_scss_styling_conventions.md` — one file per component, wrapper pattern
- `docs/reference/06_slot_system.md` — slot syntax used in examples
- `docs/online/EDITS.md` — PascalCase-in-docs convention; `Jqhtml_Component` keeps its underscore

### Last Updated
2026-08-18

### Editorial Notes
- **Correction applied 2026-08-18 before publication:** the `StatusPill` and `Alert` examples
  originally carried the variant class as an interpolated `<Define:>` attribute
  (`class="pill pill-<%= this.args.tone %>"`). The compiler REJECTS that outright - "Template
  expressions cannot be used in `<Define:>` tag attributes" (`packages/parser/src/parser.ts:203-236`).
  `<Define:>` attributes are static template metadata, not per-instance values. Both examples now
  keep a static base class and apply the variant with `<% this.$.addClass(...) %>`, which is the
  fix the parser's own error message recommends; verified rendering in a browser before commit.
  The same broken pattern still exists in several places elsewhere in the docs - see the incident
  note in the audit.
- New chapter. Appended as 17 rather than inserted; existing chapter numbers are consumed by the website parser and by the source-mapping table in `docs/online/CLAUDE.md`, so nothing was renumbered.
- Scope split from chapter 01: chapter 01 states the semantic-first premise as a doorway; this chapter is the working practice. Chapter 01 now links here.
- Synthesized from the two official semantic docs plus the sharper formulations in the internal semantic-composition reference. Where the official docs stated an idea vaguely and the internal reference stated it precisely, the precise version was used — specifically: the two-live-call-sites evidence bar (official doc 17 said only "the third time"), the extract/lever/promote decision table with the identical-default regression duty, the content-versus-argument rule, spacing ownership, and the empty-state mandate.
- **Generalized away from the internal reference (product-specific, not framework-specific):** the named page-scaffold and section components of a particular design system (rendered here as the generic principle "one component owns page layout", illustrated with `PageLayout`); a specific product's CLI commands for man pages, debugging and linting (replaced with "load the page with sparse data" and plain regression checking); the named KPI-cell and sidebar-KPI-group components and the associated "KPIs belong in the sidebar" ruling (a design-system opinion, not a JQHTML principle — dropped entirely); the `$flush` argument name (shown as `$bleed`, presented as an example name rather than an API); the `--block-gap`/`--card-pad-y` design-token names (replaced with generic illustrative names); the "Rule of Two Chips" chip taxonomy (kept only as the underlying principle that lookalike concepts stay separate components); the living-registry file path (dropped — every project's own convention); provisional-money rendering and parent-chain idioms (product UX rulings with no JQHTML content).
- Deliberately omitted the internal reference's claim that slot-only inheritance re-scopes a parent's `$sid` lookups. It is a behavioral claim about the runtime that could not be verified against `packages/` or `tests/` while writing this chapter, and documenting unverified runtime behavior is worse than omitting it.
- Every construct used in an example was checked against the parser and test fixtures: `extends=`, `<Slot:name>`, `content('name')`, `<%= %>` inside quoted attribute values, `tag=`, unquoted `$arg=expression`. No invented syntax.
- Kept the house tone: no marketing voice, no "powerful"/"elegant", every concept carries a code example.
