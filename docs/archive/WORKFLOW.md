# Symphony Dashboard - Development Workflow

## 🚀 Smart Development Process

### **Branch Strategy**
```
main (production)     ← Stable, auto-deploys to production
  ↑
develop (staging)     ← Integration branch, auto-deploys to staging
  ↑
feature/* branches    ← Individual features, auto-deploys to preview URLs
```

### **Daily Development**

#### **Starting New Feature**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

#### **Working on Feature**
```bash
# Make changes, test locally
npm run dev

# Commit changes
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

#### **Deploy Preview**
- Netlify automatically creates: `https://feature-your-feature-name--your-site.netlify.app`
- Test your feature in production environment
- Share preview URL for stakeholder review

#### **Merge to Production**
```bash
# Create PR: feature/your-feature → develop
# After review, merge to develop

# Then: develop → main (production)
git checkout main
git pull origin main
git merge develop
git push origin main
```

### **Netlify Deployment Environments**

| Branch | Environment | URL | Purpose |
|--------|------------|-----|---------|
| `main` | **Production** | `https://your-site.netlify.app` | Live site |
| `develop` | **Staging** | `https://develop--your-site.netlify.app` | Integration testing |
| `feature/*` | **Preview** | `https://feature-name--your-site.netlify.app` | Feature testing |

### **Environment Variables**

All environments share the same variables:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `BIGQUERY_DATASET=symphony_dashboard`
- `GOOGLE_CLOUD_PROJECT_ID=kcsymphony`

### **Best Practices**

✅ **DO:**
- Create feature branches for all changes
- Test locally with `npm run dev`
- Use preview URLs for stakeholder feedback
- Keep commits focused and descriptive
- Merge develop → main weekly for production updates

❌ **DON'T:**
- Push directly to main
- Work on develop branch directly
- Skip testing on preview URLs
- Commit sensitive credentials

### **Quick Commands**

```bash
# Start new feature
npm run feature:start feature-name

# Deploy current branch
git push origin HEAD

# Quick production update
npm run deploy:production
```

### **Emergency Hotfix**
```bash
git checkout main
git checkout -b hotfix/critical-bug-fix
# Fix, test, commit
git push origin hotfix/critical-bug-fix
# Create PR directly to main
```

This workflow ensures:
- 🛡️ **Production Safety**: Main branch stays stable
- 🔄 **Automatic Previews**: Every branch gets a live URL
- 👥 **Team Collaboration**: Easy code reviews
- 🚀 **Fast Deployment**: Preview → Staging → Production