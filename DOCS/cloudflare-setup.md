# MySafeOps — Cloudflare Deployment Guide

## Architecture
```
mysafeops.com (Cloudflare Pages)
    ├── Frontend: React SPA
    ├── API: Cloudflare Workers  (/api/*)
    ├── Database: Cloudflare D1  (SQLite)
    ├── Storage: Cloudflare R2   (photos, files)
    └── Auth: Workers + D1       (JWT tokens)
```

## Step 1: Create Cloudflare Pages project

```bash
# In your project directory
npm create cloudflare@latest mysafeops -- --framework=react

# Or if you already have the React project:
cd mysafeops
npx wrangler pages project create mysafeops
```

## Step 2: Create D1 Database

```bash
# Create the database
npx wrangler d1 create mysafeops-db

# Note the database_id from output, add to wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "mysafeops-db"
# database_id = "xxxxx-xxxx-xxxx-xxxx"

# Apply schema
npx wrangler d1 execute mysafeops-db --file=./database-schema.sql
```

## Step 3: Create R2 Bucket

```bash
# Create bucket for file storage
npx wrangler r2 bucket create mysafeops-files

# Add to wrangler.toml:
# [[r2_buckets]]
# binding = "STORAGE"
# bucket_name = "mysafeops-files"
```

## Step 4: wrangler.toml

```toml
name = "mysafeops"
compatibility_date = "2024-01-01"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "mysafeops-db"
database_id = "YOUR_DB_ID_HERE"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "mysafeops-files"

[vars]
ENVIRONMENT = "production"
JWT_SECRET = "CHANGE_THIS_TO_RANDOM_STRING"
MAX_UPLOAD_SIZE = "10485760"  # 10MB

# Storage limits per plan (bytes)
STORAGE_FREE = "104857600"      # 100MB
STORAGE_SOLO = "2147483648"     # 2GB
STORAGE_TEAM = "10737418240"    # 10GB
STORAGE_BUSINESS = "53687091200" # 50GB
```

## Step 5: Custom Domain

```bash
# In Cloudflare Dashboard:
# 1. Go to Pages > mysafeops > Custom domains
# 2. Add: mysafeops.com
# 3. Add: www.mysafeops.com (redirect to mysafeops.com)
# SSL is automatic
```

## Step 6: Workers API Routes

Create `functions/api/` directory for Pages Functions:

```
functions/
├── api/
│   ├── auth/
│   │   ├── login.js        POST /api/auth/login
│   │   ├── register.js     POST /api/auth/register
│   │   └── me.js           GET  /api/auth/me
│   ├── projects/
│   │   ├── index.js        GET/POST /api/projects
│   │   └── [id].js         GET/PUT/DELETE /api/projects/:id
│   ├── documents/
│   │   ├── index.js        GET/POST /api/documents
│   │   └── [id].js         GET/PUT/DELETE /api/documents/:id
│   ├── workers/
│   │   ├── index.js        GET/POST /api/workers
│   │   └── [id].js         GET/PUT/DELETE /api/workers/:id
│   ├── vehicles/
│   │   ├── index.js        GET/POST /api/vehicles
│   │   └── [id].js         GET/PUT/DELETE /api/vehicles/:id
│   ├── equipment/
│   │   ├── index.js        GET/POST /api/equipment
│   │   └── [id].js         GET/PUT/DELETE /api/equipment/:id
│   ├── photos/
│   │   ├── upload.js       POST /api/photos/upload
│   │   └── [id].js         GET/DELETE /api/photos/:id
│   ├── registers/
│   │   └── index.js        GET/POST /api/registers
│   ├── checklists/
│   │   └── index.js        GET/POST /api/checklists
│   ├── inductions/
│   │   └── index.js        GET/POST /api/inductions
│   ├── early-access.js     POST /api/early-access
│   └── feature-request.js  POST /api/feature-request
```

## Step 7: Deploy

```bash
# Build React app
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist

# Or connect GitHub for auto-deploy:
# Cloudflare Dashboard > Pages > Connect to Git
# Build command: npm run build
# Output directory: dist
```

## Step 8: Environment Variables (secrets)

```bash
# Set secrets (not in wrangler.toml)
npx wrangler pages secret put JWT_SECRET
# Enter a random 64-char string

npx wrangler pages secret put ADMIN_EMAIL
# Your admin email for first setup
```

## Storage Enforcement (in Workers)

```javascript
// Example: check storage before upload
async function checkStorageLimit(env, orgId) {
  const org = await env.DB.prepare(
    'SELECT plan, storage_used_bytes, storage_limit_bytes FROM organisations WHERE id = ?'
  ).bind(orgId).first();

  if (!org) throw new Error('Organisation not found');

  const limits = {
    free: 104857600,      // 100MB
    solo: 2147483648,     // 2GB
    team: 10737418240,    // 10GB
    business: 53687091200  // 50GB
  };

  const limit = limits[org.plan] || limits.free;

  return {
    used: org.storage_used_bytes,
    limit: limit,
    remaining: limit - org.storage_used_bytes,
    percentUsed: Math.round((org.storage_used_bytes / limit) * 100)
  };
}
```

## Photo Upload with Compression

```javascript
// In Workers: compress before storing to R2
export async function onRequestPost(context) {
  const { env, request } = context;
  const formData = await request.formData();
  const file = formData.get('photo');

  if (!file) return new Response('No file', { status: 400 });

  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return new Response('File too large (max 10MB)', { status: 413 });
  }

  // Check storage limit
  const storage = await checkStorageLimit(env, orgId);
  if (storage.remaining < file.size) {
    return new Response(JSON.stringify({
      error: 'Storage limit reached',
      used: storage.used,
      limit: storage.limit,
      plan: org.plan
    }), { status: 507 });
  }

  // Store to R2
  const key = `${orgId}/${projectId}/photos/${Date.now()}-${file.name}`;
  await env.STORAGE.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  // Update storage counter
  await env.DB.prepare(
    'UPDATE organisations SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?'
  ).bind(file.size, orgId).run();

  return new Response(JSON.stringify({ url: key, size: file.size }));
}
```

## Monitoring

- **Cloudflare Analytics**: Built-in, free
- **Workers Analytics**: Request counts, errors, latency
- **D1 Analytics**: Query counts, storage size
- **R2 Dashboard**: Storage used, operations count

## Costs at Scale

| Users | D1 Reads/day | R2 Storage | Workers Req/day | Monthly Cost |
|-------|-------------|------------|-----------------|-------------|
| 10    | ~5,000      | ~500MB     | ~2,000          | £0           |
| 100   | ~50,000     | ~5GB       | ~20,000         | £0           |
| 500   | ~250,000    | ~25GB      | ~100,000        | ~£5          |
| 1000  | ~500,000    | ~50GB      | ~200,000        | ~£10-15      |
| 5000  | ~2,500,000  | ~250GB     | ~1,000,000      | ~£50-80      |

All within Cloudflare free/cheap tiers until ~5000 users.
