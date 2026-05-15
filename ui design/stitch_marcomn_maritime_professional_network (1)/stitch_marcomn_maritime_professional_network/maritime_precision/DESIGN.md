---
name: Maritime Precision
colors:
  surface: '#faf9fd'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f7'
  surface-container: '#eeedf1'
  surface-container-high: '#e9e7eb'
  surface-container-highest: '#e3e2e6'
  on-surface: '#1a1c1e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f88'
  primary: '#000d22'
  on-primary: '#ffffff'
  primary-container: '#002349'
  on-primary-container: '#718bb7'
  inverse-primary: '#adc8f6'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#735c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cca830'
  on-tertiary-container: '#4f3e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#adc8f6'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#2c476f'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#faf9fd'
  on-background: '#1a1c1e'
  surface-variant: '#e3e2e6'
typography:
  headline-lg:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-lg:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-md:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Public Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is anchored in the concepts of **stability, global authority, and navigational precision**. It is designed to foster a high-trust environment where maritime professionals from Singapore to the Philippines can network with the same reliability they expect from maritime charts and enterprise-grade logistics.

The aesthetic follows a **Corporate / Modern** direction. It prioritizes clarity and structured information density over decorative elements. The visual language uses sharp execution and a disciplined grid to mirror the technical nature of the maritime industry, ensuring the platform feels like a professional tool rather than a casual social network.

## Colors

The palette is dominated by **MarComn Blue**, a deep navy that conveys institutional permanence and depth. This is supported by a sophisticated range of **Slate Grays** used for secondary text and UI borders, ensuring the interface remains crisp and legible.

**Crisp White** is the primary background color to maintain an airy, professional feel, especially important for high-density enterprise data. For functional accents, we use **'Verified' Gold** to denote premium status or official credentials, and a sharp **Cyan** for interactive elements and success states, reminiscent of clear coastal waters and modern maritime technology.

## Typography

This design system utilizes **Public Sans**, an institutional, neutral typeface that excels in legibility across both desktop and PWA mobile views. It provides the "official" tone necessary for an enterprise maritime platform.

Headlines are set with tight letter-spacing and heavy weights to command authority. Body text prioritizes a generous line-height to ensure readability during long networking sessions or when reviewing complex professional profiles. Labels use uppercase styling and increased tracking to differentiate metadata from primary content.

## Layout & Spacing

The layout is built on a **12-column fluid grid** for desktop, transitioning to a single-column layout for PWA mobile views. We employ a strict **4px baseline rhythm** to ensure vertical alignment and consistency.

Enterprise data density is managed through "Comfortable" and "Compact" modes. Standard views use 24px (lg) margins to allow the UI to breathe, while data-heavy networking lists use 16px (md) gutters to maximize information visibility without clutter. On mobile, margins are locked to 16px to preserve screen real estate for maritime professionals on the go.

## Elevation & Depth

Visual hierarchy is primarily established through **Tonal Layers** and **Low-Contrast Outlines**. Instead of heavy shadows, this design system uses subtle surface variances to separate content.

1.  **Level 0 (Base):** Background (#F8FAFC).
2.  **Level 1 (Cards/Surface):** White (#FFFFFF) with a 1px Slate-200 border.
3.  **Level 2 (Dropdowns/Popovers):** White with an ultra-diffused, 10% opacity MarComn Blue shadow (0px 4px 12px) to suggest float without breaking the professional flatness.

This approach ensures the UI feels lightweight and modern, avoiding the "heavy" feel of traditional enterprise software.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding removes the aggressive edge of pure 90-degree corners, making the interface feel modern and approachable, yet remains sharp enough to convey precision and technical rigor. 

Larger containers like profile cards or modals may use **rounded-lg (0.5rem)** to create a distinct containerized feel, while buttons and input fields stay strictly at the base soft radius for a cohesive, professional look.

## Components

### Buttons
Primary buttons use the solid **MarComn Blue** with white text. Secondary buttons use a Slate border with the Navy text. All buttons feature a 1px border and a subtle hover state that deepens the background color by 10%.

### Chips & Badges
"Verified" badges are a signature component, featuring a **Gold** icon on a light gold tint background. Status chips (e.g., "At Sea," "In Port") use the **Cyan** palette for high visibility.

### Lists & Tables
Maritime data is presented in clean, striped tables using Slate-50 for zebra-striping. Rows feature a 1px bottom border to maintain horizontal scanning speed.

### Input Fields
Inputs are white with a 1px Slate border. On focus, the border transitions to MarComn Blue with a 2px Cyan outer glow to provide clear visual feedback during data entry.

### Profiles & Networking Cards
Cards use a Level 1 elevation (white background + subtle border). Key networking metrics (Years at Sea, Vessel Type) are displayed using the **label-md** typography style for instant identification.