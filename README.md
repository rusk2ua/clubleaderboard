# Club Awards Program — Contest Leaderboard

> **Automated contest scoring and leaderboard system for ham radio contest clubs**

The Club Awards Program processes Cabrillo log files submitted by club members after ham radio contests, validates membership and dues status, calculates normalized Club Award Points, and displays live and historical leaderboards. It also monitors DX cluster telnet feeds to award **Cheerleader Points** to members who spot other club members on the air.

> **Note for YCCC operators:** This codebase was originally built for the Yankee Clipper Contest Club. The club-specific strings (club name validation in `server/scoring-engine.ts`, Cabrillo CLUB field matching in `server/cabrillo-parser.ts`, and the roster URL in `server/roster-scraper.ts`) remain configured for YCCC. See [Adapting for Another Club](#adapting-for-another-club) if you are deploying this for a different organization.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Scoring System](#scoring-system)
- [API Reference](#api-reference)
- [Frontend Pages & Routes](#frontend-pages--routes)
- [Background Services](#background-services)
- [Environment Variables](#environment-variables)
- [AWS ECS / Fargate Deployment](#aws-ecs--fargate-deployment)
- [Replit Deployment](#replit-deployment)
- [Local Development with Docker Compose](#local-development-with-docker-compose)
- [Gmail Email Setup](#gmail-email-setup)
- [DX Cluster Configuration](#dx-cluster-configuration)
- [Admin Panel](#admin-panel)
- [Cabrillo Log Format](#cabrillo-log-format)
- [Adapting for Another Club](#adapting-for-another-club)
- [Estimated AWS Costs](#estimated-aws-costs)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Cabrillo log ingestion** — Upload one or many `.log` files simultaneously; parser extracts contest, callsign, claimed score, mode, operators, and club
- **Membership validation** — Only operators whose dues are current for the contest year are scored; expired-dues operators are listed but excluded from points
- **Configurable scoring** — Choose between Fixed (1,000,000 max points) or Participant-Based (50,000 pts × log count, cap 1M) normalization
- **Duplicate handling** — Re-uploading a callsign/contest/year combination automatically supersedes the prior submission
- **Dense ranking** — Ties receive the same rank; the next rank is not skipped
- **Leaderboards** — All-Time, Current Year, and Historical tabs with per-member and per-contest drill-downs
- **Cheerleader Points** — Live telnet connection to a DX cluster; awards configurable points when a member spots another club member
- **Daily roster sync** — Pulls the current member roster from the club website every 24 hours automatically
- **Real-time updates** — WebSocket broadcasts push new submissions and roster syncs to all connected browsers without a page refresh
- **Email confirmations** — Optional HTML confirmation email sent to the submitter via Gmail API
- **Admin panel** — Admin page at `/skipper` for manual roster sync, contest data clearing, and scoring configuration
- **Achievement tiers** — Gold trophy (Elite Performer), medal (High Achiever), star (Runner Up) icons based on cumulative all-time Club Award Points
- **Dark mode by default** — Professional ham radio aesthetic; Inter UI font, JetBrains Mono for callsigns/scores

---

## Architecture Overview

```
┌────────────────────────────────────────┐
│              Browser (React)           │
│  Vite + TailwindCSS + Shadcn UI        │
│  TanStack Query · Wouter router        │
│  WebSocket client (live updates)       │
└───────────────┬────────────────────────┘
                │ HTTPS + WSS
        ┌───────▼────────┐
        │  AWS ALB        │  (TLS termination, Route 53 DNS)
        └───────┬────────┘
                │ HTTP port 5000
        ┌───────▼────────┐
        │  ECS Fargate    │  (single task, awsvpc networking)
        │  Node container │
        │  ├ routes.ts    │
        │  ├ websocket.ts │
        │  ├ scheduler.ts │
        │  ├ cluster-client.ts
        │  └ scoring-engine.ts
        └───────┬────────┘
                │ Drizzle ORM (neon-serverless driver)
        ┌───────▼────────┐
        │  Neon PostgreSQL│  (cloud-hosted, no VPC needed)
        └────────────────┘

Secrets:  AWS Secrets Manager → ECS task (injected as env vars)
Images:   ECR repository → ECS task definition
Logs:     CloudWatch Logs (/ecs/club-leaderboard)
```

**Tech stack:**

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite |
| UI components | Shadcn UI (Radix primitives) + Tailwind CSS |
| Routing | Wouter |
| Data fetching | TanStack Query v5 |
| Charts | Recharts |
| Backend | Express.js (ESM) |
| Runtime type-safety | Zod + drizzle-zod |
| ORM | Drizzle ORM |
| Database | PostgreSQL via Neon serverless driver |
| File parsing | Multer (upload) + PapaParse (CSV) |
| Auth (email) | Google Gmail API (googleapis) |
| Animation | Framer Motion |
| Language | TypeScript 5.6 throughout |

---

## Project Structure

```
club-leaderboard/
├── client/                     # React frontend (Vite SPA)
│   ├── index.html
│   └── src/
│       ├── App.tsx             # Root router (Wouter Switch)
│       ├── main.tsx            # React entry point
│       ├── index.css           # Global Tailwind imports
│       ├── components/
│       │   ├── ui/             # Shadcn UI primitives (auto-generated)
│       │   ├── ContestBadge.tsx
│       │   ├── ContestResultsTable.tsx
│       │   ├── FileUploadZone.tsx
│       │   ├── MemberCard.tsx
│       │   ├── ScoreboardTable.tsx
│       │   ├── StatCard.tsx
│       │   ├── ThemeProvider.tsx
│       │   └── ThemeToggle.tsx
│       ├── hooks/
│       │   ├── use-mobile.tsx
│       │   ├── use-toast.ts
│       │   └── use-websocket.ts  # WS connection + message handler
│       ├── lib/
│       │   ├── queryClient.ts    # TanStack Query config
│       │   └── utils.ts          # cn() and helpers
│       └── pages/
│           ├── HomePage.tsx          # Dashboard with 4 insight cards
│           ├── UploadPage.tsx        # Cabrillo log upload UI
│           ├── AdminPage.tsx         # /skipper admin panel
│           ├── MemberDetailPage.tsx  # Per-member stats
│           ├── MembersListPage.tsx   # All members table
│           ├── OperatorDetailPage.tsx
│           ├── ContestDetailPage.tsx # Per-contest leaderboard
│           ├── ContestsListPage.tsx  # All contests
│           ├── AllSubmissionsPage.tsx
│           ├── SubmissionDetailPage.tsx
│           └── not-found.tsx
├── server/                     # Express backend
│   ├── index.ts                # App bootstrap, port binding
│   ├── routes.ts               # All REST endpoints + /health
│   ├── db.ts                   # Drizzle + Neon client init
│   ├── storage.ts              # DB access layer (repository pattern)
│   ├── cabrillo-parser.ts      # Cabrillo file format parser
│   ├── scoring-engine.ts       # Points calculation & validation
│   ├── roster-scraper.ts       # Club website roster scraper
│   ├── scheduler.ts            # 24-hour roster sync cron
│   ├── cluster-client.ts       # DX telnet cluster monitor
│   ├── websocket.ts            # WS server + broadcast()
│   ├── email-service.ts        # Gmail send helper
│   ├── gmail-client.ts         # Google OAuth2 / Gmail API client
│   └── vite.ts                 # Dev: Vite middleware; Prod: static serve
├── shared/
│   └── schema.ts               # Drizzle table definitions + Zod schemas
├── test-data/
│   └── sample-roster.csv       # Sample member roster for testing
├── Dockerfile                  # Multi-stage container build
├── docker-compose.yml          # Local development environment
├── .dockerignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── drizzle.config.ts
├── components.json
└── design_guidelines.md
```

---

## Database Schema

All tables are defined in `shared/schema.ts` using Drizzle ORM and auto-typed via `$inferSelect`.

### `members`
Stores club member roster synced from the club website.

| Column | Type | Notes |
|---|---|---|
| `callsign` | `text` PK | Primary callsign, uppercase |
| `active_yn` | `boolean` | Soft-delete flag |
| `aliases` | `text` | Comma-separated alternate callsigns |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `dues_expiration` | `text` | YYYY format; used for dues validation |

### `submissions`
One row per Cabrillo log file accepted by the system.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK | Auto-generated |
| `season_year` | `integer` | Contest year parsed from QSO dates |
| `contest_year` | `integer` | Same as season_year (kept for legacy) |
| `contest_key` | `text` | Normalized contest name (e.g., `CQ-WW-CW`) |
| `mode` | `text` | `CW`, `SSB`, `RTTY`, `MIXED` |
| `callsign` | `text` | Station callsign from log |
| `category_operator` | `text` | `SINGLE-OP`, `MULTI-OP`, etc. |
| `claimed_score` | `integer` | Score from Cabrillo header |
| `operator_list` | `text` | Comma-separated all operators |
| `member_operators` | `text` | Comma-separated dues-valid members only |
| `total_operators` | `integer` | Count of all listed operators |
| `effective_operators` | `integer` | Count of dues-valid members |
| `club` | `text` | Must match your club name |
| `submitted_at` | `timestamp` | Upload time |
| `is_active` | `boolean` | False when superseded by re-upload |

Indexes: `season_year`, `contest_key`, `callsign`, `is_active`, composite `(season_year, contest_key)`.

### `raw_logs`
Stores the raw Cabrillo file content verbatim.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK | |
| `submission_id` | `integer` | FK → submissions.id (unique) |
| `filename` | `text` | Original filename |
| `content` | `text` | Full Cabrillo file text |
| `received_at` | `timestamp` | |

### `baselines`
Highest single claimed score per contest per year — the normalization denominator.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK | |
| `season_year` | `integer` | |
| `contest_key` | `text` | |
| `highest_single_claimed` | `real` | Updated on every new submission |

Unique constraint on `(season_year, contest_key)`.

### `operator_points`
Individual points awarded to each member operator for each submission.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK | |
| `submission_id` | `integer` | FK → submissions.id |
| `member_callsign` | `text` | |
| `individual_claimed` | `real` | Prorated share of claimed score |
| `normalized_points` | `real` | Club Award Points (rounded integer) |

### `cheerleader_points`
Cumulative DX cluster spotting points per member per season.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK | |
| `member_callsign` | `text` | |
| `season_year` | `integer` | |
| `total_spots` | `integer` | Count of qualifying spots |
| `cheerleader_points` | `integer` | Points awarded |

Unique on `(member_callsign, season_year)`.

### `cheerleader_spots`
Individual spot event log for audit trail.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK | |
| `member_callsign` | `text` | The spotter (must be club member) |
| `spotted_callsign` | `text` | Who was spotted (must be club member) |
| `frequency` | `text` | In kHz |
| `spotted_at` | `timestamp` | |
| `points_awarded` | `integer` | |

### `scoring_config`
Key-value store for runtime-configurable settings.

| Key | Values | Default | Notes |
|---|---|---|---|
| `scoring_method` | `fixed` / `participant-based` | `fixed` | Normalization method |
| `cluster_enabled` | `true` / `false` | `false` | DX cluster monitor on/off |
| `cluster_fqdn` | hostname | `dxc.w6cua.org` | Telnet server |
| `cluster_port` | port number | `7300` | |
| `cluster_login_callsign` | callsign | | Login identity for the cluster |
| `cluster_points_per_spot` | integer | `10` | Cheerleader points per qualifying spot |

---

## Scoring System

### Contest Points (Normalized)

For each active submission, every dues-valid member operator receives an **individual claimed score**:

```
individualClaimed = claimedScore / effectiveOperators
```

Normalized against the highest individual claimed score in the same contest/year (the "baseline"):

**Fixed method:**
```
normalizedPoints = round((individualClaimed / baseline) × 1,000,000)
```

**Participant-based method:**
```
maxPoints = min(logCount × 50,000 , 1,000,000)
normalizedPoints = round((individualClaimed / baseline) × maxPoints)
```

When a new submission sets a new baseline, all prior submissions for that contest/year are **recomputed** automatically.

### Cheerleader Points

The DX cluster monitor normalizes callsigns (`N2WQ/1 → N2WQ`, `V47/K5ZD → K5ZD`, `LZ/K1XM/p → K1XM`), checks both spotter and spotted against the dues-valid member cache, and awards `pointsPerSpot` to the spotter when both are current club members.

### Club Award Points (Total)

```
totalClubPoints = contestPoints + cheerleaderPoints
```

Leaderboards rank on `totalClubPoints` using dense ranking (ties share a rank; no rank is skipped).

---

## API Reference

All endpoints are under `/api`. The server exposes `GET /health` for ALB health checks.

### Log Upload

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a single Cabrillo `.log` file. Multipart form: `file` (required), `email` (optional) |
| `POST` | `/api/upload-multiple` | Upload multiple `.log` files in one request |

### Leaderboards & Stats

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/leaderboard` | All-time leaderboard |
| `GET` | `/api/leaderboard/:year` | Leaderboard for a specific season year |
| `GET` | `/api/contests` | All contests with submission counts |
| `GET` | `/api/contests/:key` | Contest detail with per-year leaderboards |
| `GET` | `/api/members` | All active members |
| `GET` | `/api/members/:callsign` | Member profile with point history |
| `GET` | `/api/operator/:callsign` | Operator detail |
| `GET` | `/api/submissions` | All submissions (paginated) |
| `GET` | `/api/submissions/:id` | Single submission detail |
| `GET` | `/api/stats/recent-logs` | Most recent log uploads |
| `GET` | `/api/stats/most-active` | Top operators by submission count |
| `GET` | `/api/stats/competitive-contests` | Contests with most participants |
| `GET` | `/api/stats/top-cheerleaders` | Top DX-spotting members |

### Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/sync-roster` | Manually trigger roster sync from club website |
| `DELETE` | `/api/admin/contest/:key/:year` | Remove all submissions for a contest/year |
| `GET` | `/api/admin/scoring-config` | Read current scoring configuration |
| `POST` | `/api/admin/scoring-config` | Update a scoring config key/value |
| `GET` | `/api/admin/cluster-status` | DX cluster connection status |
| `POST` | `/api/admin/cluster-restart` | Restart the DX cluster connection |

---

## Frontend Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | HomePage | Dashboard: 4 insight cards + leaderboard tabs |
| `/upload` | UploadPage | Drag-and-drop Cabrillo file upload |
| `/member/:callsign` | MemberDetailPage | Individual member stats and point history |
| `/operator/:callsign` | OperatorDetailPage | Operator-level detail |
| `/contest/:key` | ContestDetailPage | Contest leaderboard by year |
| `/contests` | ContestsListPage | All contests table |
| `/submission/:id` | SubmissionDetailPage | Single submission breakdown |
| `/submissions` | AllSubmissionsPage | Paginated full submission history |
| `/members` | MembersListPage | Full member roster |
| `/skipper` | AdminPage | Admin control panel |

---

## Background Services

### Roster Sync Scheduler (`server/scheduler.ts`)
Runs `syncRoster()` on startup then every 24 hours. Scrapes the club roster page, replaces all member records atomically, and broadcasts a `roster:synced` WebSocket event.

### DX Cluster Monitor (`server/cluster-client.ts`)
Persistent TCP telnet connection. Sends a keepalive every 90 seconds, sets a 5-minute idle socket timeout, and reconnects automatically on disconnect. Maintains a 5-minute in-memory member cache to minimize DB queries.

### WebSocket Server (`server/websocket.ts`)
Attached to the same HTTP server as Express. Events: `submission:new`, `roster:synced`, `cluster:spot`. The ALB must be configured with a long idle timeout to support WebSocket connections (see deployment section).

---

## Environment Variables

These are injected into the ECS task from AWS Secrets Manager. **Never bake secrets into the Docker image or commit them to the repository.**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Neon PostgreSQL connection string (`postgresql://...?sslmode=require`) |
| `NODE_ENV` | **Yes** | Set to `production` |
| `PORT` | No | HTTP port the app listens on (default `5000`) |
| `GOOGLE_CLIENT_ID` | No | Gmail OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Gmail OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | No | Gmail OAuth refresh token |

---

## AWS ECS / Fargate Deployment

### Overview of resources created

| Resource | Purpose |
|---|---|
| ECR repository | Stores Docker images |
| ECS cluster | Logical grouping for the Fargate task |
| ECS task definition | Declares the container, CPU/memory, env vars, logging |
| ECS service | Keeps one task running; replaces it on failure |
| Application Load Balancer | TLS termination, HTTPS, WebSocket support |
| ACM certificate | Free TLS cert for your domain |
| Route 53 A record | Points your domain to the ALB |
| Secrets Manager secret | Stores `DATABASE_URL` and Gmail credentials |
| CloudWatch Log Group | Captures container stdout/stderr |
| IAM roles | Task execution role (ECR + Secrets pull) and task role |

---

### Prerequisites

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured (`aws configure`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Your AWS account ID: `aws sts get-caller-identity --query Account --output text`
- A Route 53 hosted zone already created for your domain

Set these shell variables now — they are used throughout every command below:

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012        # your 12-digit account ID
APP_NAME=club-leaderboard
ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME
DOMAIN=leaderboard.yourclub.org    # your domain or subdomain
```

---

### Step 1 — Add a Dockerfile to the project

Create `Dockerfile` in the project root:

```dockerfile
# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 5000

CMD ["node", "dist/index.js"]
```

Create `.dockerignore` in the project root:

```
node_modules
dist
.env
.git
attached_assets
*.png
replit*
```

Commit both files:

```bash
git add Dockerfile .dockerignore
git commit -m "Add Dockerfile for ECS/Fargate deployment"
git push origin main
```

---

### Step 2 — Create the ECR repository

```bash
aws ecr create-repository \
  --repository-name $APP_NAME \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true
```

---

### Step 3 — Build and push the Docker image

```bash
# Authenticate Docker to ECR (token expires after 12 hours)
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin \
    $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build, tag, and push
docker build -t $APP_NAME .
docker tag $APP_NAME:latest $ECR_REPO:latest
docker push $ECR_REPO:latest
```

---

### Step 4 — Store secrets in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name club-leaderboard/env \
  --region $AWS_REGION \
  --secret-string '{
    "DATABASE_URL": "postgresql://user:pass@host.neon.tech/db?sslmode=require",
    "GOOGLE_CLIENT_ID": "",
    "GOOGLE_CLIENT_SECRET": "",
    "GOOGLE_REFRESH_TOKEN": ""
  }'
```

Note the secret ARN from the output — you will need it in the task definition.

To update a secret later:

```bash
aws secretsmanager update-secret \
  --secret-id club-leaderboard/env \
  --region $AWS_REGION \
  --secret-string '{ "DATABASE_URL": "new-value" }'
```

---

### Step 5 — Create IAM roles

```bash
# Task execution role
aws iam create-role \
  --role-name ecsTaskExecutionRole-club \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole-club \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam put-role-policy \
  --role-name ecsTaskExecutionRole-club \
  --policy-name SecretsManagerRead \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':secret:club-leaderboard/env*"
    }]
  }'
```

---

### Step 6 — Create an ECS cluster and log group

```bash
aws ecs create-cluster \
  --cluster-name club-leaderboard \
  --region $AWS_REGION

aws logs create-log-group \
  --log-group-name /ecs/club-leaderboard \
  --region $AWS_REGION
```

---

### Step 7 — Register the ECS task definition

Replace `<SECRET_ARN>` with the ARN from Step 4:

```bash
aws ecs register-task-definition \
  --region $AWS_REGION \
  --family club-leaderboard \
  --requires-compatibilities FARGATE \
  --network-mode awsvpc \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole-club \
  --container-definitions '[
    {
      "name": "club-leaderboard",
      "image": "'"$ECR_REPO"':latest",
      "portMappings": [{ "containerPort": 5000, "protocol": "tcp" }],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT",     "value": "5000" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':secret:club-leaderboard/env:DATABASE_URL::"
        },
        {
          "name": "GOOGLE_CLIENT_ID",
          "valueFrom": "arn:aws:secretsmanager:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':secret:club-leaderboard/env:GOOGLE_CLIENT_ID::"
        },
        {
          "name": "GOOGLE_CLIENT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':secret:club-leaderboard/env:GOOGLE_CLIENT_SECRET::"
        },
        {
          "name": "GOOGLE_REFRESH_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:'"$AWS_REGION"':'"$AWS_ACCOUNT_ID"':secret:club-leaderboard/env:GOOGLE_REFRESH_TOKEN::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/club-leaderboard",
          "awslogs-region": "'"$AWS_REGION"'",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "essential": true
    }
  ]'
```

**CPU/memory sizing:** `512` CPU units (0.25 vCPU) and `1024` MB is sufficient for club-scale traffic. Scale up to `1024`/`2048` if you observe memory pressure in CloudWatch.

---

### Step 8 — Create the Application Load Balancer

#### 8a. Create a target group (AWS Console)

1. EC2 → **Target Groups** → **Create target group**
2. Target type: **IP addresses**
3. Protocol: **HTTP**, Port: **5000**
4. VPC: your default VPC
5. Health check path: `/health`, interval: `30s`, healthy threshold: `2`, unhealthy: `3`
6. Name: `club-leaderboard-tg`

#### 8b. Create the ALB

1. EC2 → **Load Balancers** → **Create Load Balancer** → **Application Load Balancer**
2. Name: `club-leaderboard-alb`, Scheme: **Internet-facing**
3. Select at least two Availability Zones
4. Listeners: HTTP:80 and HTTPS:443 (forwarding to `club-leaderboard-tg`)
5. Security group: allow inbound 80 and 443 from `0.0.0.0/0`
6. SSL certificate: **Request a new ACM certificate** → enter your domain → DNS validation (Route 53 creates the CNAME automatically)

#### 8c. HTTP → HTTPS redirect

ALB → Listeners → HTTP:80 → Edit → Default action: **Redirect** → HTTPS:443, 301.

#### 8d. Set idle timeout for WebSocket support

EC2 → Load Balancers → select your ALB → **Attributes** → Edit → **Idle timeout** → `3600` seconds.

The ALB forwards WebSocket `Upgrade` headers transparently — no additional listener rule is needed.

---

### Step 9 — Point Route 53 to the ALB

1. Route 53 → Hosted zones → your domain → **Create record**
2. Name: your subdomain, Type: **A**, toggle **Alias** on
3. Route traffic to: **Alias to Application and Classic Load Balancer** → select your ALB
4. Create the record

---

### Step 10 — Create the ECS service

```bash
# Find your default subnet IDs
aws ec2 describe-subnets \
  --filters "Name=default-for-az,Values=true" \
  --query "Subnets[*].{ID:SubnetId,AZ:AvailabilityZone}" \
  --output table --region $AWS_REGION

# Create a security group for the task (inbound 5000 from ALB SG only)
TASK_SG=$(aws ec2 create-security-group \
  --group-name club-leaderboard-task-sg \
  --description "Club leaderboard ECS task" \
  --query GroupId --output text --region $AWS_REGION)

aws ec2 authorize-security-group-ingress \
  --group-id $TASK_SG \
  --protocol tcp \
  --port 5000 \
  --source-group sg-YOURALB_SG_ID \
  --region $AWS_REGION

# Create the service
TG_ARN=arn:aws:elasticloadbalancing:$AWS_REGION:$AWS_ACCOUNT_ID:targetgroup/club-leaderboard-tg/XXXX

aws ecs create-service \
  --cluster club-leaderboard \
  --service-name club-leaderboard-svc \
  --task-definition club-leaderboard \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-aaa,subnet-bbb],
    securityGroups=[$TASK_SG],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=club-leaderboard,containerPort=5000" \
  --health-check-grace-period-seconds 120 \
  --region $AWS_REGION
```

---

### Step 11 — Push the database schema

Run once from your local machine:

```bash
DATABASE_URL="postgresql://..." npm run db:push
```

---

### Step 12 — Verify the deployment

```bash
# Watch the service reach a steady state (~2 minutes)
aws ecs describe-services \
  --cluster club-leaderboard \
  --services club-leaderboard-svc \
  --region $AWS_REGION \
  --query "services[0].{Status:status,Running:runningCount,Desired:desiredCount}"

# Health check
curl https://$DOMAIN/health

# Live logs
aws logs tail /ecs/club-leaderboard --follow --region $AWS_REGION
```

---

### Restricting the `/skipper` Admin Panel

Use an ALB listener rule to block `/skipper` from the public internet. In the AWS Console:

1. ALB → Listeners → HTTPS:443 → **Manage rules** → **Add rule**
2. **Condition:** Path is `/skipper*`
3. **Action:** Fixed response → 403, or forward to target group only if source IP matches your IP
4. Set rule priority **higher** (lower number) than the default forward rule

Alternatively, add a lightweight token check directly in `server/routes.ts`:

```typescript
// In routes.ts, before /skipper routes:
app.use('/skipper', (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

Add `ADMIN_TOKEN` to your Secrets Manager secret and task definition.

---

### Updating the Application

```bash
# Rebuild and push new image
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin \
    $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker build -t $APP_NAME .
docker tag $APP_NAME:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Rolling replacement — new task starts, health check passes, old task drains
aws ecs update-service \
  --cluster club-leaderboard \
  --service club-leaderboard-svc \
  --force-new-deployment \
  --region $AWS_REGION
```

If the schema changed, run `npm run db:push` before the deployment.

---

### Automating Deployments with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: club-leaderboard
  ECS_CLUSTER: club-leaderboard
  ECS_SERVICE: club-leaderboard-svc

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region:            ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Push database schema (if changed)
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npm run db:push

      - name: Force new ECS deployment
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
```

Add these secrets in GitHub → Settings → Secrets → Actions:
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — IAM user with ECR push + ECS update + Secrets read permissions
- `DATABASE_URL` — your Neon connection string (for the `db:push` step)

---

## Replit Deployment

This project was originally developed on Replit. To restore it there:

1. In Replit, create a new Repl → **Import from GitHub** → paste the repo URL
2. In the Replit **Secrets** panel, add `DATABASE_URL`
3. Click **Run** — `.replit` is configured to run `npm run dev`
4. For Gmail, use Replit's native Gmail integration in the Integrations panel instead of managing OAuth tokens manually

> The `.replit` and `replit.md` files contain Replit-specific configuration — do not delete them if you want to keep Replit as a staging environment.

---

## Local Development with Docker Compose

Docker Compose lets you run the app locally against your Neon database without installing Node.js directly. It also matches the production container environment exactly.

### Setup

Create `docker-compose.yml` in the project root:

```yaml
version: "3.9"

services:
  app:
    build:
      context: .
      target: builder          # use the build stage so source changes hot-reload
    command: npm run dev
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: development
      PORT: 5000
    env_file:
      - .env                   # put DATABASE_URL and optional Gmail creds here
    volumes:
      - .:/app                 # mount source for hot reload
      - /app/node_modules      # preserve container node_modules
    restart: unless-stopped
```

Create a `.env` file in the project root (never commit this):

```env
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
# Optional:
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# GOOGLE_REFRESH_TOKEN=...
```

### Start the dev environment

```bash
# First time — push the schema to Neon
DATABASE_URL="postgresql://..." npm run db:push

# Start the app
docker compose up
```

Open `http://localhost:5000` in your browser. Source file changes trigger hot reload via Vite's HMR.

### Useful commands

```bash
docker compose up --build    # rebuild image before starting (after package.json changes)
docker compose down          # stop and remove containers
docker compose logs -f app   # tail logs
docker compose exec app sh   # open a shell inside the container
```

### Test the production build locally

To verify the production Docker image before pushing to ECR:

```bash
# Build the production image
docker build -t club-leaderboard:test .

# Run it with your .env
docker run --rm -p 5000:5000 --env-file .env club-leaderboard:test

# Confirm health check passes
curl http://localhost:5000/health
```

---

## Gmail Email Setup

Email confirmations are optional. If the Gmail environment variables are absent, the server logs a warning and continues normally.

### To enable:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Gmail API**
3. Under **Credentials**, create an **OAuth 2.0 Client ID** (Desktop App type)
4. Use the [Google OAuth Playground](https://developers.google.com/oauthplayground/) to get a refresh token with scope `https://mail.google.com/`
5. Store all three values in the `club-leaderboard/env` Secrets Manager secret (see Step 4 of deployment)

The confirmation email is triggered after a successful log upload when the user provides their email address.

---

## DX Cluster Configuration

The DX cluster monitor is **disabled by default**. Enable it via the Admin panel at `/skipper`.

### To enable:

1. Navigate to `/skipper`
2. Under **DX Cluster Settings**, set:
   - **Enabled**: on
   - **Hostname**: `dxc.w6cua.org` (or your preferred cluster)
   - **Port**: `7300`
   - **Login callsign**: your callsign
   - **Points per spot**: `10`
3. Save, then click **Restart Cluster Connection**

The Fargate task makes an **outbound** TCP connection to the cluster on port 7300. This is allowed by default in AWS — no additional security group rule is needed.

---

## Admin Panel

The admin panel is at `/skipper`. See [Restricting the /skipper Admin Panel](#restricting-the-skipper-admin-panel) in the deployment section for access control options.

| Action | Description |
|---|---|
| **Sync Roster** | Immediately fetches and replaces the member list from the club website |
| **Clear Contest Data** | Removes all submissions and related points for a selected contest/year |
| **Scoring Method** | Toggle between Fixed and Participant-Based normalization |
| **DX Cluster Config** | Enable/disable the cluster, set host/port/callsign/points |
| **Cluster Status** | Shows current connection state |
| **Restart Cluster** | Force-reconnect the cluster client |

---

## Cabrillo Log Format

The system accepts standard **Cabrillo v3** format `.log` files. Required headers:

```
START-OF-LOG: 3.0
CONTEST:      CQ-WW-CW
CALLSIGN:     N2WQ
CATEGORY-OPERATOR: SINGLE-OP
CLAIMED-SCORE: 1234567
CLUB:         Yankee Clipper Contest Club
OPERATORS:    N2WQ
QSO:  14005 CW 2024-11-23 1200 N2WQ        599 05    K1ZZ        599 05
END-OF-LOG:
```

**Key validation rules:**
- `CLUB:` must match your configured club name (see `server/scoring-engine.ts`)
- All callsigns in `OPERATORS:` are checked against the member roster
- Contest year is extracted from QSO date lines, not the submission timestamp
- Multi-operator logs split the claimed score equally among dues-valid operators

---

## Adapting for Another Club

Three files contain YCCC-specific values that must be updated to deploy this for a different organization:

**`server/scoring-engine.ts`** — Club name validation:
```typescript
// Change this line:
const expectedClub = "YANKEE CLIPPER CONTEST CLUB";
// To your club's Cabrillo name:
const expectedClub = "YOUR CONTEST CLUB NAME";
```

**`server/cabrillo-parser.ts`** — Cabrillo CLUB field matching:
```typescript
// Update both strings to match your club's Cabrillo header values:
if (clubUpper.includes('YANKEE CLIPPER CONTEST CLUB') || clubUpper.includes('YCCC')) {
  data.club = 'Yankee Clipper Contest Club';
```

**`server/roster-scraper.ts`** — Roster source URL:
```typescript
// Change this URL to your club's member roster page:
const html = await httpsGet('https://yccc.org/roster/');
```

If your club's roster page has a different HTML structure than yccc.org, you will also need to update the parser logic in `fetchClubRoster()` in the same file.

---

## Estimated AWS Costs

These are approximate monthly costs based on AWS us-east-1 pricing as of 2025. Actual costs depend on traffic and data transfer.

| Service | Configuration | Est. Monthly Cost |
|---|---|---|
| ECS Fargate | 0.25 vCPU, 1 GB RAM, running 24/7 | ~$9 |
| Application Load Balancer | 1 ALB + minimal LCU usage | ~$17 |
| ECR | < 1 GB image storage | ~$0.10 |
| Secrets Manager | 1 secret, < 10,000 API calls/month | ~$0.40 |
| CloudWatch Logs | < 5 GB/month ingestion | ~$2.50 |
| Route 53 | 1 hosted zone + queries | ~$0.60 |
| ACM Certificate | Free (included with ALB) | $0 |
| Neon PostgreSQL | Free tier (0.5 GB, 190 compute hours) covers club-scale usage | $0 |
| **Total** | | **~$30/month** |

**Cost reduction options:**

- **Scheduled scaling:** If the leaderboard only needs to be live during contest season (typically weekends Oct–Mar), you can scale the ECS service to 0 tasks during off-hours using an EventBridge scheduled rule, cutting Fargate cost by ~70%
- **Fargate Spot:** Not recommended for this app — the DX cluster telnet connection and daily scheduler need continuous uptime
- **ALB sharing:** If you run other web services in the same AWS account, a single ALB can host multiple apps using listener rules, eliminating the per-ALB fixed cost for this project

---

## Troubleshooting

### ECS task stops immediately after starting
Check CloudWatch Logs at `/ecs/club-leaderboard`. The most common cause is a missing or malformed `DATABASE_URL`. Verify the Secrets Manager secret name matches exactly and the task execution role has `secretsmanager:GetSecretValue` on that secret's ARN.

### Health check fails and task is killed repeatedly
The ALB health check hits `GET /health`. The `startPeriod` in the task definition is 60 seconds to accommodate the initial roster sync. Also confirm the task security group allows inbound TCP 5000 from the ALB security group.

### WebSocket connections drop after ~60 seconds
The ALB idle timeout defaults to 60 seconds. Set it to `3600` seconds as described in Step 8d.

### `npm run db:push` fails with SSL error
Add `?sslmode=require` to the end of your Neon connection string.

### Roster sync fails / returns 0 members
Check CloudWatch Logs for the error detail. The scraper fetches the club roster URL. If the page HTML structure changed, `fetchClubRoster()` in `server/roster-scraper.ts` will need updating. Temporarily import `test-data/sample-roster.csv` from the Admin page.

### ECR push fails with "no basic auth credentials"
Re-run the `aws ecr get-login-password | docker login ...` command — the token expires after 12 hours.

### Docker Compose hot reload not working
Ensure the `volumes` mount in `docker-compose.yml` maps `.:/app`. On Windows with WSL2, also make sure the project is inside the WSL2 filesystem (not `/mnt/c/...`) for reliable inotify events.

### High memory over time
Force a new deployment to recycle the task: `aws ecs update-service --force-new-deployment`. Enable Container Insights on the ECS cluster for detailed memory metrics: AWS Console → ECS → cluster → Update cluster → Container Insights: Enhanced.

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first.

**Code style:**
- TypeScript strict mode throughout
- Zod schemas for all API inputs
- Drizzle ORM for all DB access
- TanStack Query for all client data fetching

---

## License

MIT — see `package.json`

---

*73 de Rus, K2UA (forked from a project by N2WQ of the Yankee Clipper Contest Club)*
