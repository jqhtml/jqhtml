# Incremental Scaffolding with Undefined Components

## Overview

JQHTML allows you to use component names before they're defined. This enables **incremental scaffolding** - writing semantic HTML structure first, then implementing component behavior incrementally.

## How It Works

### Undefined Component Behavior

When a component is referenced but not defined:

**No .jqhtml template**: Gets default template containing just `<%= content() %>`

**No JavaScript class**: Uses base `Jqhtml_Component` with default lifecycle

**Renders as**: `<div>` (or whatever `tag` is set to) with the content passed to it

**Component name still added**: Gets the component name as a CSS class

### Example

```blade
<!-- None of these are defined yet -->
<PageHeader>
  <SiteLogo />
  <NavigationMenu>
    <NavItem>Home</NavItem>
    <NavItem>About</NavItem>
    <NavItem>Contact</NavItem>
  </NavigationMenu>
</PageHeader>

<PageBody>
  <Sidebar>
    <UserWidget />
    <RecentActivity />
  </Sidebar>
  <ContentArea>
    <ArticleList />
  </ContentArea>
</PageBody>
```

**Renders immediately as**:
```html
<div class="PageHeader Component">
  <div class="SiteLogo Component"></div>
  <div class="NavigationMenu Component">
    <div class="NavItem Component">Home</div>
    <div class="NavItem Component">About</div>
    <div class="NavItem Component">Contact</div>
  </div>
</div>

<div class="PageBody Component">
  <div class="Sidebar Component">
    <div class="UserWidget Component"></div>
    <div class="RecentActivity Component"></div>
  </div>
  <div class="ContentArea Component">
    <div class="ArticleList Component"></div>
  </div>
</div>
```

**Benefits**:
- Semantic, readable HTML structure
- Works immediately (no errors)
- Clear component boundaries
- Easy CSS targeting with component names

## Development Workflow

### 1. Start with Semantic Structure

Write HTML using meaningful component names:

```blade
<DashboardWidget>
  <WidgetHeader>
    <WidgetTitle>Sales Statistics</WidgetTitle>
    <WidgetActions>
      <RefreshButton />
      <ExportButton />
    </WidgetActions>
  </WidgetHeader>

  <WidgetBody>
    <StatsGrid>
      <StatCard $label="Revenue" $value="$45,230" />
      <StatCard $label="Orders" $value="1,234" />
      <StatCard $label="Customers" $value="567" />
    </StatsGrid>
  </WidgetBody>

  <WidgetFooter>
    Last updated: 2 minutes ago
  </WidgetFooter>
</DashboardWidget>
```

**This renders and works immediately** - all as basic divs with content.

### 2. Implement Incrementally

Add `.jqhtml` templates as needed:

**widget_header.jqhtml**:
```jqhtml
<Define:WidgetHeader tag="header" class="widget-header">
  <div class="header-content">
    <%= content() %>
  </div>
</Define:WidgetHeader>
```

**Now WidgetHeader has custom markup**, rest still basic divs.

### 3. Add Behavior Incrementally

Add JavaScript classes when needed:

**RefreshButton.js**:
```javascript
class RefreshButton extends Jqhtml_Component {
  on_ready() {
    this.$.on('click', () => {
      this.refresh_data();
    });
  }

  async refresh_data() {
    // Refresh logic
    this.$.trigger('refresh-requested');
  }
}
```

**refresh_button.jqhtml**:
```jqhtml
<Define:RefreshButton tag="button" class="btn btn-refresh">
  🔄 Refresh
</Define:RefreshButton>
```

**Now RefreshButton is interactive**, rest still basic.

### 4. Add Styling Incrementally

**widget_header.scss**:
```scss
.WidgetHeader {
  background: #f5f5f5;
  padding: 1rem;
  border-bottom: 1px solid #ddd;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
```

### 5. Final Result

All components enhanced, but **same structure as initial scaffold** - no refactoring needed.

## Practical Use Cases

### 1. Prototype Quickly

```blade
<UserProfile>
  <Avatar />
  <UserInfo>
    <UserName>John Doe</UserName>
    <UserTitle>Senior Developer</UserTitle>
    <UserLocation>San Francisco, CA</UserLocation>
  </UserInfo>
  <ActionMenu>
    <MenuItem>Edit Profile</MenuItem>
    <MenuItem>Settings</MenuItem>
    <MenuItem>Logout</MenuItem>
  </ActionMenu>
</UserProfile>
```

**Works immediately with zero implementation.**

### 2. Team Collaboration

**Frontend developer** writes structure:
```blade
<ProductCatalog>
  <FilterSidebar>
    <CategoryFilter />
    <PriceFilter />
    <BrandFilter />
  </FilterSidebar>

  <ProductGrid>
    <ProductCard $product_id="1" />
    <ProductCard $product_id="2" />
    <ProductCard $product_id="3" />
  </ProductGrid>
</ProductCatalog>
```

**Backend developer** implements data loading while frontend works on styling:
```javascript
class ProductCard extends Jqhtml_Component {
  async on_load() {
    this.data = await ProductModel.fetch(this.args.product_id);
  }
}
```

**No coordination needed** - structure works from day one.

### 3. Progressive Enhancement

Start simple:
```blade
<CommentSection>
  <Comment>First comment</Comment>
  <Comment>Second comment</Comment>
</CommentSection>
```

Add features over time:
- Week 1: Basic comment display
- Week 2: Voting system
- Week 3: Reply threading
- Week 4: Real-time updates

**Same component structure throughout.**

### 4. Design System Development

Create semantic component library:
```blade
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardSubtitle>Subtitle</CardSubtitle>
  </CardHeader>
  <CardBody>
    Content
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

Implement design system incrementally:
1. Structure defined (day 1)
2. Styling added (week 1)
3. Variants added (week 2)
4. Interactions added (week 3)

## Setting Element Type for Undefined Components

Even undefined components support the `tag` attribute:

```blade
<NavigationMenu tag="nav">
  <NavItem tag="a" href="/home">Home</NavItem>
  <NavItem tag="a" href="/about">About</NavItem>
</NavigationMenu>
```

**Renders as**:
```html
<nav class="NavigationMenu Component">
  <a href="/home" class="NavItem Component">Home</a>
  <a href="/about" class="NavItem Component">About</a>
</nav>
```

**Semantic HTML from day one**, even before components defined.

## CSS Targeting Before Implementation

Component names in class make styling easy:

```scss
// Style undefined components
.PageHeader {
  background: #fff;
  border-bottom: 1px solid #eee;
  padding: 1rem;
}

.Sidebar {
  width: 250px;
  background: #f5f5f5;
}

.ContentArea {
  flex: 1;
  padding: 2rem;
}

// These work immediately, before .jqhtml files exist
```

## jQuery Selection Before Implementation

Select and manipulate undefined components:

```javascript
// Hide all sidebar widgets on mobile
if (window.innerWidth < 768) {
  $('.Sidebar .UserWidget').hide();
  $('.Sidebar .RecentActivity').hide();
}

// Add loading state to content area
$('.ContentArea').addClass('loading');

// Works even though components not defined yet
```

## When to Define Components

### Keep Undefined When:
- Simple containers with no special behavior
- Structural elements that just wrap content
- Temporary scaffolding that might change
- Prototyping and experimentation

### Define When:
- Custom markup structure needed
- Interactive behavior required
- Data loading necessary
- Lifecycle hooks needed
- Reusable patterns emerge

## Default Template Behavior

Undefined components get this default template:
```jqhtml
<Define:UndefinedComponent>
  <%= content() %>
</Define:UndefinedComponent>
```

This means:
- Content passes through
- Wraps in element (div by default)
- Component name added to class
- Lifecycle runs (but no custom logic)

## Complete Example: Blog Application

### Initial Scaffold
```blade
<BlogLayout>
  <BlogHeader>
    <SiteBranding />
    <MainNavigation>
      <NavLink>Home</NavLink>
      <NavLink>Articles</NavLink>
      <NavLink>About</NavLink>
    </MainNavigation>
    <UserMenu />
  </BlogHeader>

  <BlogContent>
    <ArticleList>
      <% for (let article of this.data.articles) { %>
        <ArticleCard $article_id=article.id />
      <% } %>
    </ArticleList>

    <SidebarWidgets>
      <SearchWidget />
      <CategoriesWidget />
      <RecentPostsWidget />
      <NewsletterWidget />
    </SidebarWidgets>
  </BlogContent>

  <BlogFooter>
    <FooterLinks />
    <SocialIcons />
    <CopyrightNotice />
  </BlogFooter>
</BlogLayout>
```

**This entire structure works immediately** - all components undefined.

### Week 1: Implement Article Cards
```jqhtml
<Define:ArticleCard tag="article" class="article-card">
  <div class="article-image">
    <img $sid="image" src="<%= this.data.image_url %>" />
  </div>
  <div class="article-content">
    <h2 $sid="title"><%= this.data.title %></h2>
    <p $sid="excerpt"><%= this.data.excerpt %></p>
    <a $sid="link" href="<%= this.data.url %>">Read More →</a>
  </div>
</Define:ArticleCard>
```

```javascript
class ArticleCard extends Jqhtml_Component {
  async on_load() {
    this.data = await ArticleModel.fetch(this.args.article_id);
  }
}
```

**Rest of structure still undefined** - works fine.

### Week 2: Add Search
```javascript
class SearchWidget extends Jqhtml_Component {
  on_ready() {
    this.$sid('search_input').on('input', debounce(() => {
      this.perform_search();
    }, 300));
  }

  async perform_search() {
    const query = this.$sid('search_input').val();
    // Search logic
  }
}
```

### Week 3: More Components
Incrementally implement NewsletterWidget, CategoriesWidget, etc.

**No refactoring of structure needed** - just adding implementation to existing component names.

## Philosophy

This approach embodies JQHTML's core philosophy:

1. **Start simple** - Basic HTML works immediately
2. **Enhance progressively** - Add complexity only where needed
3. **Semantic naming** - Component names document structure
4. **No ceremony** - Don't need boilerplate to use a component name
5. **Flexibility** - Implement when ready, not before

Unlike frameworks that require definition before use, JQHTML lets you **write the HTML you want first, implement it later**.

## Key Concepts

1. **Undefined components work** - Render as basic containers
2. **Default template** - Just `<%= content() %>`
3. **Default class** - Base `Component`
4. **Component name in class** - CSS and jQuery targeting works
5. **Incremental implementation** - Add behavior when needed
6. **No refactoring** - Structure stable, implementation added
7. **Team collaboration** - Structure and implementation can proceed independently
8. **Semantic HTML first** - Write readable, meaningful markup immediately
