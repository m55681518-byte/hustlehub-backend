# HustleHub Backend - Deploy Instructions

## What You Need Before Starting

1. Git installed on your computer
2. Your hustlehub-backend folder on Desktop
3. The hustlehub-backend-complete.zip extracted

## STEP-BY-STEP DEPLOYMENT

### Step 1: Extract the Zip File

1. Right-click `hustlehub-backend-complete.zip`
2. Click "Extract All"
3. Choose Desktop as destination
4. Click "Extract"

You should now have a folder called `hustlehub-backend-complete` on your Desktop.

---

### Step 2: Copy Files to Your GitHub Repo Folder

1. Open your existing `hustlehub-backend` folder (the one you created earlier)
2. DELETE these old files:
   - `server.js`
   - `package.json`
3. From the `hustlehub-backend-complete` folder, COPY these files:
   - `server.js`
   - `package.json`
   - `mpesaService.js`
   - `callback.js`
   - `status.js`
   - `stkpush.js`
   - `errorHandler.js`
4. PASTE them into your `hustlehub-backend` folder

---

### Step 3: Create the Missing Folders

In your `hustlehub-backend` folder, create two new folders:

1. Right-click in the folder → New → Folder → Name it `routes`
2. Right-click in the folder → New → Folder → Name it `middleware`
3. Right-click in the folder → New → Folder → Name it `services`

Now move the files:
- Move `stkpush.js`, `callback.js`, `status.js` into `routes/`
- Move `errorHandler.js` into `middleware/`
- Move `mpesaService.js` into `services/`

Your folder should look like this:
```
hustlehub-backend/
├── server.js
├── package.json
├── .gitignore
├── .env
├── routes/
│   ├── stkpush.js
│   ├── callback.js
│   └── status.js
├── middleware/
│   └── errorHandler.js
└── services/
    └── mpesaService.js
```

---

### Step 4: Update Your .env File

Open `.env` in Notepad. Change ONLY this line:

OLD:
```
MPESA_CALLBACK_URL=https://vintage-subtext-reemerge.ngrok-free.dev/callback
```

NEW:
```
MPESA_CALLBACK_URL=https://hustlehub-backend-3h1v.onrender.com/callback
```

Save and close.

---

### Step 5: Run the Deploy Script

1. Double-click `deploy.bat` (in the extracted zip folder)
2. It will automatically:
   - Add all files to Git
   - Commit the changes
   - Push to GitHub
3. If it asks for username/password, enter:
   - Username: Your GitHub username
   - Password: Your GitHub Personal Access Token

Wait until you see "[OK] Pushed to GitHub successfully!"

---

### Step 6: Deploy on Render

1. The script will open https://dashboard.render.com automatically
2. Log in to Render
3. Click on your service: `hustlehub-backend-3h1v`
4. Click the blue button: **Manual Deploy**
5. Select: **Deploy latest commit**
6. Wait 2-3 minutes for the green checkmark

---

### Step 7: Test Your Backend

Open this URL in your browser:
```
https://hustlehub-backend-3h1v.onrender.com
```

You should see:
```json
{
  "status": "OK",
  "service": "HustleHub M-Pesa Backend",
  "version": "1.0.0"
}
```

---

## TROUBLESHOOTING

### "git is not recognized"
- Git is not installed. Download from git-scm.com

### "failed to push"
- Check your GitHub Personal Access Token
- Make sure it has "repo" permissions

### "Build failed" on Render
- Check the Logs tab in Render dashboard
- Make sure all files are in the correct folders

### "Cannot find module"
- The folder structure is wrong
- Make sure `services/`, `routes/`, `middleware/` folders exist

---

## SUPPORT

If you get stuck, tell me:
1. What step you're on
2. What error message you see
3. Screenshot if possible
