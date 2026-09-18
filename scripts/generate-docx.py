# -*- coding: utf-8 -*-
"""Generate GlobeTrotter-Documentation.docx from the project's documentation content."""
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

TEAL = RGBColor(0x0F, 0x7B, 0x6E)
DARK = RGBColor(0x22, 0x2A, 0x35)
GRAY = RGBColor(0x5A, 0x63, 0x70)
CODE_BG = "F2F4F7"
HDR_BG = "0F7B6E"
ALT_BG = "F6F9F8"

doc = Document()

# Base style
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)
normal.font.color.rgb = DARK
normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")

for sec in doc.sections:
    sec.top_margin = Inches(0.8)
    sec.bottom_margin = Inches(0.8)
    sec.left_margin = Inches(0.9)
    sec.right_margin = Inches(0.9)


def shade(cell, hex_color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hex_color)
    cell._tc.get_or_add_tcPr().append(shd)


def h1(text):
    p = doc.add_heading(text, level=1)
    for r in p.runs:
        r.font.color.rgb = TEAL
        r.font.size = Pt(20)
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(8)
    return p


def h2(text):
    p = doc.add_heading(text, level=2)
    for r in p.runs:
        r.font.color.rgb = DARK
        r.font.size = Pt(14)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    return p


def para(text, bold_prefix=None, italic=False, size=11, color=None):
    p = doc.add_paragraph()
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
    r = p.add_run(text)
    r.italic = italic
    r.font.size = Pt(size)
    if color:
        r.font.color.rgb = color
    return p


def bullets(items):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        if isinstance(it, tuple):
            r = p.add_run(it[0])
            r.bold = True
            p.add_run(it[1])
        else:
            p.add_run(it)
        p.paragraph_format.space_after = Pt(2)


def code_block(lines):
    for line in lines:
        p = doc.add_paragraph()
        r = p.add_run(line)
        r.font.name = "Consolas"
        r.element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
        r.font.size = Pt(9.5)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        pPr = p._p.get_or_add_pPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:fill"), CODE_BG)
        pPr.append(shd)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ""
        r = hdr[i].paragraphs[0].add_run(h)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        shade(hdr[i], HDR_BG)
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for ci, val in enumerate(row):
            cells[ci].text = ""
            r = cells[ci].paragraphs[0].add_run(str(val))
            r.font.size = Pt(10)
            if ri % 2 == 1:
                shade(cells[ci], ALT_BG)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


# ── Cover ────────────────────────────────────────────────────────────────────
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = title.add_run("🌍 GlobeTrotter")
r.font.size = Pt(34)
r.bold = True
r.font.color.rgb = TEAL

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("Plan Your Journey. Experience More.")
r.font.size = Pt(14)
r.italic = True
r.font.color.rgb = GRAY

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = meta.add_run("Project Documentation  ·  v1.0.0  ·  September 2026")
r.font.size = Pt(11)
r.font.color.rgb = GRAY

desc = doc.add_paragraph()
desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = desc.add_run(
    "A full-stack, personalised travel-planning platform that turns a rough idea into a real, "
    "bookable-quality itinerary: multi-city routes with per-city dates, a day-by-day activity "
    "schedule, a live budget breakdown, and a public share link anyone can open."
)
r.font.size = Pt(11)
doc.add_paragraph()

# ── 1. Purpose ───────────────────────────────────────────────────────────────
h1("1. Purpose of the Project")
para(
    "Planning a multi-city trip usually means juggling spreadsheets, notes apps and booking sites. "
    "GlobeTrotter solves this with a single workspace where a traveller can:"
)
bullets([
    ("Discover — ", "destinations from a curated city catalogue (search, filters, cost index, popularity)."),
    ("Plan a route — ", "multiple cities, each with its own arrive/leave dates, automatically re-clamped so a route can never become invalid."),
    ("Build an itinerary — ", "day by day with drag-and-drop scheduling, conflict detection and a curated activity catalogue per city."),
    ("Track a budget — ", "per-category and per-day breakdowns, a manual expense log and an optional spending limit with an over-budget alert."),
    ("View everything on a calendar — ", "month / week / day / timeline views with drag-to-reschedule."),
    ("Share a trip — ", "publicly via a link (no account needed to view) and let other travellers copy the trip into their own account."),
])
para("In short: one platform for the whole journey — from inspiration to a complete, costed, shareable itinerary.", bold_prefix="")

# ── 2. Technologies ──────────────────────────────────────────────────────────
h1("2. Technologies Used")

h2("Frontend  (client/)")
table(
    ["Technology", "Version", "Role"],
    [
        ["React", "19", "UI library"],
        ["TypeScript", "5.9", "Type safety across the whole app"],
        ["Vite", "8", "Dev server & build tool (proxies /api to the backend in dev)"],
        ["Tailwind CSS", "4", "Utility-first styling, design tokens via CSS variables"],
        ["React Router DOM", "7", "Client-side routing, route guards, layouts"],
        ["TanStack React Query", "5", "Server-state management: caching, refetching, mutations"],
        ["Axios", "1.x", "HTTP client with a session interceptor"],
        ["React Hook Form + Zod", "7 / 3", "Form state and schema validation shared with the API"],
        ["Radix UI", "latest", "Accessible headless primitives (dialogs, selects, tabs…)"],
        ["dnd-kit", "6 / 10", "Drag-and-drop for itinerary reordering and calendar rescheduling"],
        ["Recharts", "2.x", "Budget pie chart and cost-per-day bar chart"],
        ["Framer Motion", "13", "Animations and page transitions"],
        ["lucide-react", "—", "Icon set"],
        ["sonner", "2.x", "Toast notifications"],
        ["date-fns", "4.x", "Date formatting and calendar maths"],
        ["cva + clsx + tailwind-merge", "—", "Component variant and class utilities"],
    ],
    widths=[2.3, 0.9, 3.3],
)

h2("Backend  (server/)")
table(
    ["Technology", "Version", "Role"],
    [
        ["Node.js", "≥ 20", "Runtime"],
        ["Express", "5", "REST API framework"],
        ["TypeScript", "5.9", "Type safety"],
        ["Prisma ORM", "6", "Type-safe database access, migrations and seeding"],
        ["PostgreSQL", "14+", "Relational database"],
        ["Zod", "3", "Request validation on every route"],
        ["jsonwebtoken (JWT)", "9", "Session tokens"],
        ["bcryptjs", "3", "Password hashing"],
        ["Helmet", "8", "Security headers"],
        ["CORS + cookie-parser", "—", "Cross-origin support and httpOnly cookie sessions"],
        ["express-rate-limit", "8", "Brute-force protection (notably on auth routes)"],
        ["Morgan", "1.x", "HTTP request logging"],
        ["Vitest + Supertest", "4 / 7", "Integration tests against a real test database"],
    ],
    widths=[2.3, 0.9, 3.3],
)

h2("Tooling & Infrastructure")
table(
    ["Tool", "Role"],
    [
        ["npm workspaces", "Monorepo managing client/ and server/ from one root"],
        ["concurrently", "One command starts API + web dev servers together"],
        ["tsx", "TypeScript execution for dev server, seed and scripts"],
        ["embedded-postgres", "Zero-setup local PostgreSQL — npm run db:local downloads and runs a real Postgres binary on port 55432"],
        ["dotenv", "Environment configuration from a single root .env"],
    ],
    widths=[2.3, 4.2],
)

# ── 3. Architecture ──────────────────────────────────────────────────────────
h1("3. System Architecture")
code_block([
    "┌─────────────────────────────────────────────────────────────┐",
    "│                          Browser                            │",
    "│    React 19 SPA — React Query cache, Router, Tailwind UI    │",
    "└──────────────────────────┬──────────────────────────────────┘",
    "                           │  HTTP (JSON)                      ",
    "                           │  dev: Vite proxies /api → :4000   ",
    "                           ▼                                   ",
    "┌─────────────────────────────────────────────────────────────┐",
    "│                 Express 5 REST API  (port 4000)             │",
    "│   middleware: helmet → cors → cookies → rate-limit → morgan │",
    "│   routes: /auth /trips /stops /itinerary-items /expenses    │",
    "│           /cities /activities /shared /profile /saved       │",
    "│           /dashboard /admin                                 │",
    "│   controllers → services → Prisma Client                    │",
    "└──────────────────────────┬──────────────────────────────────┘",
    "                           │  SQL (Prisma)                     ",
    "                           ▼                                   ",
    "┌─────────────────────────────────────────────────────────────┐",
    "│             PostgreSQL  (port 55432 in local dev)           │",
    "│          9 models — Users, Trips, Cities, Activities…       │",
    "└─────────────────────────────────────────────────────────────┘",
])

h2("Key Architectural Decisions")
bullets([
    ("Monorepo with workspaces — ", "one npm install, one .env, shared tooling; client and server stay independently buildable."),
    ("Layered backend — ", "routes → controllers → services → Prisma. Business logic lives in services and is what the integration tests exercise."),
    ("Client state split — ", "TanStack Query owns server state (trips, cities, itinerary); React state/context owns UI state (theme, auth session, wizard steps)."),
    ("Shared validation philosophy — ", "Zod on the API, with matching schemas on the client so form errors match server rules."),
    ("Single source of truth — ", "overview, itinerary, budget and calendar views all read the same API data, so they can never disagree."),
])

# ── 4. Database ──────────────────────────────────────────────────────────────
h1("4. Database Design")
para("PostgreSQL via Prisma ORM. Full definitions in prisma/schema.prisma.")

h2("Models (9)")
table(
    ["Model", "Purpose", "Notable design points"],
    [
        ["User", "Accounts, preferences, role", "Soft-delete via deletedAt so shared itineraries survive account deletion"],
        ["PasswordResetToken", "Forgot-password flow", "Only the hash of the token is stored; tokens expire and are single-use"],
        ["Trip", "A journey: dates, sharing, budget limit", "publicSlug enables share links; sourceTripId powers Copy Trip"],
        ["City", "Curated destination catalogue", "Unique per (name, country); cost index + popularity for discovery"],
        ["TripStop", "One city visit within a trip", "Ordered route with per-city arrive/leave dates"],
        ["Activity", "Curated things to do in a city", "8 categories, duration, estimated cost, popularity"],
        ["ItineraryItem", "One scheduled day-plan entry", "Can link an Activity or be free-form; supports time, notes, custom cost"],
        ["Expense", "Manual spending log", "5 categories, Decimal(12,2) money"],
        ["SavedDestination", "City bookmarks per user", "Unique (userId, cityId)"],
    ],
    widths=[1.6, 2.1, 2.8],
)

h2("Enums")
bullets([
    ("Role — ", "USER, ADMIN"),
    ("ActivityCategory — ", "ADVENTURE, SIGHTSEEING, FOOD, CULTURE, SHOPPING, NATURE, ENTERTAINMENT, RELAXATION"),
    ("ExpenseCategory — ", "TRANSPORT, ACCOMMODATION, ACTIVITIES, MEALS, MISCELLANEOUS"),
])

h2("Data Conventions")
bullets([
    ("IDs — ", "cuid() strings, safe in URLs, no enumeration."),
    ("Dates — ", "@db.Date — a trip can never shift a day because of timezones."),
    ("Clock times — ", "\"HH:mm\" strings — trips are local-time concepts."),
    ("Money — ", "Decimal(12, 2) — no float rounding in totals."),
    ("Delete rules — ", "cascades for trip-owned data; Restrict on City so catalogue entries with history can't vanish; SetNull on Activity links so past itineraries stay intact."),
])

# ── 5. API ───────────────────────────────────────────────────────────────────
h1("5. API Overview")
para("Base URL: /api — all responses follow a consistent envelope ({ data } / { error }).")
table(
    ["Router", "Prefix", "Access", "Responsibility"],
    [
        ["Health", "/health", "Public", "Liveness check"],
        ["Auth", "/auth", "Public + session", "Signup, login, logout, me, forgot/reset password"],
        ["Trips", "/trips", "Owner/collaborator", "CRUD, filters, sorting, pagination, copy"],
        ["Stops", "/stops", "Owner", "Add / reorder / remove cities on a route"],
        ["Itinerary items", "/itinerary-items", "Owner", "CRUD, reorder, conflict checking"],
        ["Expenses", "/expenses", "Owner", "Manual expense log CRUD"],
        ["Cities", "/cities", "Public", "Discovery: search, facets, filters, popular, detail"],
        ["Activities", "/activities", "Public", "Catalogue search with filters"],
        ["Shared", "/shared", "Public", "View a shared itinerary by slug; copy it"],
        ["Profile", "/profile", "Session", "Name, avatar, language, currency, preferences, password change, account deletion"],
        ["Saved", "/saved", "Session", "Save / unsave cities, list bookmarks"],
        ["Dashboard", "/dashboard", "Session", "Aggregated stats, upcoming trips, notifications"],
        ["Admin", "/admin", "ADMIN role", "User management and platform analytics"],
    ],
    widths=[1.2, 1.4, 1.4, 2.5],
)
para(
    "Authentication is a JWT session token in an httpOnly cookie (invisible to client-side "
    "JavaScript), sent automatically by the browser; the client also carries an Axios "
    "interceptor to handle session expiry gracefully.",
    bold_prefix="Note: ",
)

# ── 6. Features ──────────────────────────────────────────────────────────────
h1("6. Feature Summary")
table(
    ["Area", "Highlights"],
    [
        ["Trips", "5-step creation wizard · multi-city routes with per-city dates · search, filters, sorting, pagination · grid & list views · delete with confirmation"],
        ["Itinerary", "Three-pane drag-and-drop builder · activity search with category/cost/duration filters · smart default scheduling · overlap & out-of-range conflict detection with \"Add anyway\" resolution"],
        ["Budget", "5-category split · pie + per-day bar charts · per-day statistics · manual expense log · optional limit with over-budget warning"],
        ["Calendar", "Month / week / day / timeline views · drag to reschedule or reorder · click-to-edit anything"],
        ["Discovery", "Searchable city catalogue · country/region/cost/popularity filters · rich city detail page · save/bookmark cities"],
        ["Sharing", "Public link per trip (no account needed to view) · view counter · Copy Trip into another account"],
        ["Accounts", "Signup / login / logout · forgot & reset password · profile, language & currency · theme (light/dark/system) · notification preferences · account deletion with anonymisation"],
        ["Admin", "Platform analytics · user management (role: USER / ADMIN)"],
        ["UX", "Fully responsive · dark mode · toasts · skeletons · error boundary · keyboard-accessible drag-and-drop"],
    ],
    widths=[1.3, 5.2],
)

# ── 7. Security ──────────────────────────────────────────────────────────────
h1("7. Security")
bullets([
    ("Passwords — ", "hashed with bcrypt, never stored or logged in plain text."),
    ("Sessions — ", "JWTs in httpOnly cookies — invisible to client-side JavaScript (XSS-safe)."),
    ("Reset tokens — ", "stored only as hashes, expiring and single-use."),
    ("Validation — ", "every request body/query validated with Zod before touching services."),
    ("Headers & limits — ", "Helmet security headers; rate limiting on sensitive routes."),
    ("CORS — ", "restricted to the configured client origin."),
    ("Secrets — ", "all credentials live in .env, which is gitignored; .env.example documents every variable without real values."),
])

# ── 8. Structure ─────────────────────────────────────────────────────────────
h1("8. Project Structure")
code_block([
    "GlobeTrotter/",
    "├── client/                     # React SPA (Vite workspace)",
    "│   └── src/",
    "│       ├── components/         # activity, auth, city, common, layout, trip, ui",
    "│       ├── contexts/           # AuthContext, ThemeContext",
    "│       ├── hooks/              # Reusable React hooks",
    "│       ├── layouts/            # AppShell, AuthLayout, PublicLayout, TripWorkspace",
    "│       ├── lib/                # api client, schemas, formatting, helpers",
    "│       ├── pages/              # Route pages (auth, trips, discover, admin…)",
    "│       ├── services/           # Typed API call layer",
    "│       └── types/              # Shared API types",
    "├── server/                     # Express REST API (workspace)",
    "│   └── src/",
    "│       ├── config/             # env loading, constants",
    "│       ├── controllers/        # request handling, one per domain",
    "│       ├── middleware/         # auth, validation, errors, rate limiting",
    "│       ├── routes/             # one router per domain, mounted under /api",
    "│       ├── services/           # business logic",
    "│       ├── utils/              # jwt, cookies, crypto, serializers",
    "│       ├── validators/         # Zod request schemas",
    "│       └── tests/              # Vitest + Supertest integration tests",
    "├── prisma/",
    "│   ├── schema.prisma           # Database models & migrations",
    "│   ├── migrations/             # SQL migration history",
    "│   └── seed.ts                 # Demo users, 16 cities, 118 activities",
    "├── scripts/",
    "│   ├── dev-database.ts         # Zero-setup embedded PostgreSQL launcher",
    "│   └── smoke-test.ts           # End-to-end API smoke check",
    "├── .env.example                # Documented environment template",
    "├── package.json                # Workspace root & shared scripts",
    "└── README.md                   # Full feature manual",
])

# ── 9. Setup ─────────────────────────────────────────────────────────────────
h1("9. Setup & Installation")
para("Prerequisites: Node.js ≥ 20 and npm. No database installation needed — the project ships its own embedded PostgreSQL.")
code_block([
    "# 1. Install all dependencies (root + workspaces)",
    "npm install",
    "",
    "# 2. Create your env file and adjust if needed",
    "cp .env.example .env",
    "",
    "# 3. Generate the Prisma Client",
    "npm run prisma:generate",
    "",
    "# 4. Terminal 1 — start the local database (keep this terminal open)",
    "npm run db:local",
    "",
    "# 5. Terminal 2 — create tables and load demo data",
    "npm run prisma:migrate",
    "npm run seed",
    "",
    "# 6. Start both servers",
    "npm run dev",
])
bullets([
    ("Web app — ", "http://localhost:5173"),
    ("API — ", "http://localhost:4000/api (health check: /api/health)"),
])
para(
    "Using Docker or a hosted Postgres (e.g. Neon) instead? Just point DATABASE_URL in .env at "
    "it and skip step 4 — no code changes needed.",
    italic=True,
)

# ── 10. Commands ─────────────────────────────────────────────────────────────
h1("10. Run Commands Reference")
table(
    ["Command", "What it does"],
    [
        ["npm run dev", "Start API + web dev servers together"],
        ["npm run db:local", "Start the embedded PostgreSQL (port 55432)"],
        ["npm run prisma:migrate", "Apply schema migrations"],
        ["npm run seed", "Load demo users, cities and activities"],
        ["npm run prisma:studio", "Browse the database in a GUI"],
        ["npm run typecheck", "TypeScript check for server + client"],
        ["npm run test", "Run the backend integration test suite"],
        ["npm run smoke", "End-to-end API smoke test"],
        ["npm run build", "Production build (server + client)"],
        ["npm run start", "Run the built server"],
        ["npm run db:reset", "Wipe, re-migrate and re-seed the database"],
    ],
    widths=[2.5, 4.0],
)

# ── 11. Testing ──────────────────────────────────────────────────────────────
h1("11. Testing")
para(
    "The backend has an integration test suite (Vitest + Supertest) that runs against a real "
    "test database — covering authentication, trips, itinerary, budget sharing and discovery."
)
code_block([
    "npm run test          # run once",
    "npm run test:watch    # watch mode (inside server/)",
])
para("Client quality gates: npm run typecheck (whole monorepo) and npm run build.")

# ── 12. Demo accounts ────────────────────────────────────────────────────────
h1("12. Demo Accounts")
para("Created by npm run seed — development only.")
table(
    ["Role", "Email", "Password"],
    [
        ["Demo traveller", "demo@globetrotter.app", "Password123!"],
        ["Admin", "admin@globetrotter.app", "Password123!"],
        ["Second traveller", "priya@globetrotter.app", "Password123!"],
    ],
    widths=[1.8, 2.4, 1.6],
)

doc.add_paragraph()
foot = doc.add_paragraph()
foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = foot.add_run("GlobeTrotter v1.0.0 — Documentation generated September 2026")
r.font.size = Pt(9)
r.font.color.rgb = GRAY
r.italic = True

doc.save("GlobeTrotter-Documentation.docx")
print("Created GlobeTrotter-Documentation.docx")
