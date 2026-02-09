# Troubleshooting Upload Logging

## Issue: csv_uploads table remains empty

### Possible Causes

1. **No uploads made yet**: The table will be empty if no files have been uploaded through the web interface
2. **Database connection issue**: The API route might not be connecting to the database
3. **Error during upload**: An error might be preventing the log entry

### How to Verify

1. **Check if uploads are being made**:
   - Open the web interface (http://localhost:3000)
   - Try uploading a CSV file
   - Check browser console for errors
   - Check server logs for errors

2. **Test database connection**:
   - The upload route uses `getPool()` which should connect to the database
   - Check `.env.local` in the `web/` folder has the connection string

3. **Check for errors**:
   - Look at the server console output when uploading
   - Check for any error messages

### Debug Steps

1. **Test the upload API directly**:
   ```bash
   # Test endpoint (GET request)
   curl http://localhost:3000/api/test-upload
   ```

2. **Check database directly**:
   ```sql
   SELECT * FROM him_ttdi.csv_uploads ORDER BY uploaded_at DESC;
   ```

3. **Check server logs**:
   - When you upload a file, you should see logs like:
     - `[Upload] Logged upload X for filename.csv`
     - `[Upload] Updated upload X status to success`

### Expected Behavior

When a file is uploaded:
1. ✅ An entry is created in `csv_uploads` with status 'processing'
2. ✅ After processing, status is updated to 'success' or 'failed'
3. ✅ Row counts are updated (rows_processed, rows_inserted, etc.)

### If Still Empty

1. Verify `.env.local` exists in `web/` folder
2. Verify connection string is correct
3. Check Next.js server is running
4. Try uploading a file and watch server logs
5. Check browser network tab for API response
