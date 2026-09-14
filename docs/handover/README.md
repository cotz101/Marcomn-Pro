# MarComn Launch & Operations Handover Documentation

This directory hosts internal platform operational and handover documentation intended exclusively for platform Super Administrators.

## Target File Placement
Place the finalized PDF documentation file here:
- **Filename:** MarComn_Launch_Operations_Handover_Pack.pdf
- **Full Path:** docs/handover/MarComn_Launch_Operations_Handover_Pack.pdf

## Security Note
This directory is located outside of the Next.js public/ web root. Files stored here are **NEVER** served directly to the public web. They are delivered exclusively through the protected server-side API route:
- /api/admin/operations/handover (Super Admin access required)
