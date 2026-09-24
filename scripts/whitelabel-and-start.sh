#!/bin/sh
set -e

export PAGE_TITLE="${PAGE_TITLE:-Task - bigtech}"
export PAGE_DESCRIPTION="${PAGE_DESCRIPTION:-Task boards for Bigtech}"
export THEME_COLOR="${THEME_COLOR:-#f8fafc}"

node <<'NODESCRIPT'
const fs = require('fs');

const title = process.env.PAGE_TITLE || 'Task - bigtech';
const desc = process.env.PAGE_DESCRIPTION || 'Task boards for Bigtech';
const themeColor = process.env.THEME_COLOR || '#f8fafc';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escTitle = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const indexPath = '/app/views/index.ejs';
let html = fs.readFileSync(indexPath, 'utf8');

// Hapus sisa injeksi force-light bila upgrade image dari container lama
html = html.replace(/\n?\s*<!-- bigtech-force-light -->[\s\S]*?<\/script>/, '');

html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escTitle(title) + '</title>');

html = html.replace(
  /<meta name="description" content="[^"]*"/,
  '<meta name="description" content="' + esc(desc) + '"',
);

html = html.replace(
  /<meta name="theme-color" content="[^"]*"/,
  '<meta name="theme-color" content="' + esc(themeColor) + '"',
);

// Ensure apple-touch / favicon still point at local assets
if (!html.includes('rel="apple-touch-icon"')) {
  html = html.replace(
    '</head>',
    '    <link rel="apple-touch-icon" href="/logo192.png" />\n  </head>',
  );
}

fs.writeFileSync(indexPath, html);

const manPath = '/app/public/manifest.json';
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
man.name = title;
man.short_name = 'bigtech Task';
man.theme_color = themeColor;
man.background_color = '#ffffff';
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
NODESCRIPT

exec /app/start.sh
