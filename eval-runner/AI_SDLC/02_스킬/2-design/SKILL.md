---
name: 2-design
description: Convert design files into technical implementation specs. Triggers: 디자인, 2단계, 피그마, 디자인 변환, 화면 분석. Use for Figma, mockups, or visual design translation.
---

# Design to Spec

Transform visual design files into actionable technical specifications for developers.

## When to Apply

- Design files need technical translation
- Need to extract component structure from visuals
- Converting designs to responsive breakpoints
- Documenting interactions and animations
- Preparing asset extraction lists
- Creating design token specifications

## Input Types Supported

- Figma files (with view access)
- Design image exports (PNG, JPG)
- Design tool exports (Sketch, Adobe XD)
- Design system documentation
- Style guide documents

## Output Format

**Always start output with:** `[디자인 스킬]` or `[2-design]`

```markdown
# Design Specification: [Screen/Feature Name]

## Overview
- Design Source: [Figma link / File name]
- Target Platform: [Web / iOS / Android / Multi]
- Responsive Strategy: [Desktop-first / Mobile-first]

## Screen Specifications

### [Screen Name]
**Viewport**: [Width x Height]px
**Breakpoint**: [Desktop / Tablet / Mobile]

#### Layout
```
┌─────────────────────────────┐
│ [Header: 60px, #FFFFFF]     │
├─────────────────────────────┤
│ [Content Area]              │
│                             │
└─────────────────────────────┘
```

#### Component Breakdown

##### [Component Name]
- **Position**: [x, y] from [reference]
- **Dimensions**: [width x height]px
- **Visual Spec**:
  - Background: #RRGGBB / rgba()
  - Border: [width] [style] [color]
  - Border Radius: [value]px
  - Shadow: [x] [y] [blur] [color]
- **Typography**:
  - Font: [Family] [Weight] [Size]px/[LineHeight]
  - Color: #RRGGBB
  - Alignment: [Left/Center/Right]
- **Spacing**:
  - Padding: [top] [right] [bottom] [left]px
  - Margin: [values]px
- **Interactions**:
  - Hover: [state description]
  - Active: [state description]
  - Disabled: [state description]

#### Responsive Behavior
| Breakpoint | Layout Change | Key Adjustments |
|------------|---------------|-----------------|
| < 768px | Stack vertically | Hide sidebar, full-width buttons |

## Design Tokens

### Colors
| Token Name | HEX Value | Usage |
|------------|-----------|-------|
| --color-primary | #3B82F6 | Primary buttons, links |

### Typography
| Token | Font | Size | Weight | Line Height |
|-------|------|------|--------|-------------|
| --text-heading-1 | Inter | 32px | 700 | 1.2 |

### Spacing
| Token | Value | Usage |
|-------|-------|-------|
| --space-md | 16px | Component gaps |

## Asset Inventory

| Asset Name | Format | Dimensions | Usage | Extract From |
|------------|--------|------------|-------|--------------|
| logo.svg | SVG | - | Header | [Figma layer] |
| hero-bg.png | PNG | 1440x600 | Hero section | Frame "Hero" |

## Interaction Specifications

### [Interaction Name]
**Trigger**: [Click / Hover / Scroll / etc.]
**Target**: [Element(s)]
**Animation**:
- Duration: [X]ms
- Easing: [ease-out / cubic-bezier()]
- Properties: [opacity, transform, etc.]

## Accessibility Notes
- Color contrast ratios
- Focus indicator requirements
- Screen reader considerations
- Keyboard navigation paths
```

## Workflow

### Step 1: Design Inventory
Analyze the design and identify:
- All unique screens/states
- Reusable components
- Design system elements (colors, typography, spacing)
- Interactive elements and states
- Required assets (images, icons, illustrations)

### Step 2: Component Extraction
Break down each screen into:
- Layout containers
- UI components
- Content elements
- Interactive elements

### Step 3: Specification Extraction
For each element, document:
- Precise measurements (dimensions, spacing)
- Visual properties (colors, borders, shadows)
- Typography (font, size, weight, line height)
- Positioning (absolute, relative, flex/grid context)

### Step 4: Responsive Analysis
Determine:
- Breakpoint strategy
- Layout transformations
- Content hierarchy changes
- Touch target sizes for mobile

### Step 5: Interaction Mapping
Document:
- State changes (hover, active, disabled)
- Transitions and animations
- Micro-interactions
- Loading and error states

### Step 6: Asset Preparation
List:
- Required exports (format, size, resolution)
- SVG vs raster decisions
- Optimization requirements
- Naming conventions

## Measurement Guidelines

When extracting from designs:
- Use pixel-perfect measurements
- Note padding vs margin clearly
- Document percentage-based vs fixed dimensions
- Identify grid systems and alignment guides

## Common Patterns

### Button Spec
```
Component: Primary Button
- Min Width: 120px
- Height: 44px
- Padding: 12px 24px
- Background: #3B82F6
- Border Radius: 8px
- Font: Inter 500 16px/1.5
- Color: #FFFFFF
- Hover: Background #2563EB
- Active: Background #1D4ED8
- Disabled: Background #93C5FD, Opacity 0.5
```

### Card Spec
```
Component: Info Card
- Background: #FFFFFF
- Border: 1px solid #E5E7EB
- Border Radius: 12px
- Padding: 24px
- Shadow: 0 2px 4px rgba(0,0,0,0.1)
- Responsive: Full width on mobile, 360px min on desktop
```

## Validation Checklist

- [ ] All colors extracted with HEX/RGBA values
- [ ] Typography scale documented
- [ ] Spacing system identified
- [ ] All interactive states defined
- [ ] Responsive breakpoints specified
- [ ] Asset list complete with export details
- [ ] Accessibility requirements noted
