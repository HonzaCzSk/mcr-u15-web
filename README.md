# MČR U15 – Basketball Championship Website

Repository for the official website of the Czech U15 Girls Basketball Championship.

The site provides match schedules, results, team rosters, and tournament information.

Live website: <https://mcr-u15.cz>

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- GitHub Pages (hosting)

## Project Structure

```text
├── index.html                  # Main entry point
├── pages/                      # Subpages
│   ├── rozpis.html             # Match schedule
│   ├── vysledky.html           # Results
│   ├── tabulka.html            # Standings & bracket
│   ├── tymy.html               # Teams & rosters
│   ├── info.html               # Visitor information
│   ├── kontakty.html           # Contacts
│   └── fotky.html              # Photo gallery
├── assets/
│   ├── css/                    # Stylesheets
│   ├── js/                     # Scripts
│   └── img/                    # Images, logos, favicons
├── data/                       # Tournament data (JSON)
│   ├── rozpis.json             # Match schedule
│   ├── vysledky.json           # Results
│   ├── tymy.json               # Teams & rosters
│   ├── info.json               # Venue & contact info
│   ├── media.json              # Gallery & media links
│   ├── site.json               # Site-wide config
│   └── backup/                 # Fallback data files
├── sitemap.xml
├── robots.txt
├── og-image.png
└── CNAME
```

## Content

The website contains:

- group draw and match schedule
- live updated results
- standings tables and playoff bracket
- team rosters and photos
- location and visitor information
- photo gallery and media links

## Data Updates

All tournament data is stored as JSON in the `data/` folder and loaded dynamically — no rebuild needed. To update results or the schedule during the tournament, edit the relevant JSON file and push.

## Deployment

The website is deployed using GitHub Pages. Any push to the master branch updates the live site automatically.

## About the Tournament

Czech Republic U15 Girls Basketball Championship  
8 teams competing in group stage followed by playoffs.  
24.–26. dubna 2026 • Hradec Králové
