# Basic Auth Testing Checklist

## Setup Steps

### 1. Set SITE_PASSWORD in Netlify
**Before deploying, you MUST set the password in Netlify:**

1. Go to Netlify Dashboard: https://app.netlify.com
2. Navigate to your Symphony site
3. Click **Site Settings** → **Environment Variables**
4. Click **Add a variable**
   - **Key**: `SITE_PASSWORD`
   - **Value**: [Choose a strong password]
   - **Scopes**: Check all (Production, Deploy Previews, Branch deploys)
5. Click **Create variable**

**Suggested strong password format:** Use a password generator with 16+ characters

---

## Testing on Preview (next branch)

### Preview URL
After pushing to `next` branch: **https://next--kcsdashboard.netlify.app**

---

## Test Checklist

### ✅ Test 1: Dashboard Protection
- [ ] Visit https://next--kcsdashboard.netlify.app
- [ ] **Expected**: Browser shows Basic Auth prompt
- [ ] Enter username: `kcsdashboard`
- [ ] Enter password: [SITE_PASSWORD value]
- [ ] **Expected**: Dashboard loads successfully with all charts

### ✅ Test 2: Wrong Credentials
- [ ] Clear browser auth cache (close/reopen browser or use incognito)
- [ ] Visit https://next--kcsdashboard.netlify.app
- [ ] Enter wrong username or password
- [ ] **Expected**: Access denied (401 Unauthorized)

### ✅ Test 3: Function Endpoints (Critical!)
Test that functions work WITHOUT authentication:

#### Option A: Using curl
```bash
# Test fetch-performances function (if exists)
curl https://next--kcsdashboard.netlify.app/.netlify/functions/fetch-performances

# Should return data WITHOUT asking for credentials
```

#### Option B: Using browser
- [ ] After authenticating to dashboard, open browser DevTools (F12)
- [ ] Go to Network tab
- [ ] Reload dashboard page
- [ ] Look for requests to `/.netlify/functions/*`
- [ ] **Expected**: All function calls return 200 OK (not 401)

### ✅ Test 4: Assets Loading
- [ ] Dashboard authenticated and loaded
- [ ] Check that all assets load:
  - [ ] CSS styles applied correctly
  - [ ] JavaScript files loaded
  - [ ] D3.js charts render
  - [ ] Data table displays

### ✅ Test 5: Browser Password Save
- [ ] Authenticate successfully
- [ ] Close browser completely
- [ ] Reopen browser
- [ ] Visit https://next--symphony.netlify.app
- [ ] **Expected**: Browser auto-fills credentials (or no prompt if saved)

---

## Production Testing (After merging to main)

### Production URL
After merging to `main`: **https://kcsdashboard.netlify.app**

### Repeat All Tests Above
- [ ] Test 1: Dashboard Protection ✅
- [ ] Test 2: Wrong Credentials ✅
- [ ] Test 3: Function Endpoints ✅
- [ ] Test 4: Assets Loading ✅
- [ ] Test 5: Browser Password Save ✅

---

## Troubleshooting

### Issue: "SITE_PASSWORD is undefined" error
**Solution**:
- Ensure environment variable is set in Netlify
- Check all scopes are enabled
- Trigger a manual redeploy

### Issue: Functions return 401 Unauthorized
**Solution**:
- Check `_headers` file has `Basic-Auth: none` for `/.netlify/functions/*`
- Ensure headers file is in project root
- Redeploy

### Issue: Dashboard doesn't prompt for password
**Solution**:
- Check `_headers` file syntax
- Ensure file is named `_headers` (no extension)
- Check Netlify build logs for header processing

### Issue: Browser won't save password
**Solution**:
- Ensure using HTTPS (not HTTP)
- Check browser settings allow password saving
- Try different browser

---

## Rollback Plan

If anything goes wrong:

```bash
# Remove authentication
rm _headers
git add _headers
git commit -m "Remove Basic Auth temporarily"
git push origin next  # or main
```

Or revert the commit:
```bash
git revert HEAD
git push origin next  # or main
```

---

## Success Criteria

✅ **Ready for production when:**
- Dashboard prompts for credentials on `next` branch
- Correct credentials grant access
- Wrong credentials deny access
- All charts and features work after authentication
- Function endpoints accessible without credentials
- No errors in browser console
- No errors in Netlify function logs

---

## Notes

- **Local development**: Auth does NOT work on `npm run dev` (Netlify feature only)
- **Credentials**: Username is `kcsdashboard`, password is environment variable
- **Sharing password**: Use secure channel (password manager, encrypted message)
- **Password rotation**: Recommended every 3 months
