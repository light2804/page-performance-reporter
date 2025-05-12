const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const { google } = require('googleapis');
const dayjs = require('dayjs');

const SHEET_ID = process.env.SHEET_ID;
const URLS = [
  'https://example.com',
  'https://example.com/about',
];

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function runLighthouse(url, strategy) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
    emulatedFormFactor: strategy
  };
  const result = await lighthouse(url, options);
  const score = result.lhr.categories.performance.score * 100;
  await chrome.kill();
  return score;
}

async function writeToSheet(data) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const values = data.map(d => [d.date, d.url, d.mobile, d.desktop]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:D',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });

  console.log('✅ Report sent to Google Sheets');
}

(async () => {
  const date = dayjs().format('YYYY-MM-DD');
  const allData = [];

  for (const url of URLS) {
    try {
      const mobile = await runLighthouse(url, 'mobile');
      const desktop = await runLighthouse(url, 'desktop');
      allData.push({ date, url, mobile, desktop });
    } catch (err) {
      console.error(`❌ ${url}: ${err.message}`);
    }
  }

  await writeToSheet(allData);
})();
