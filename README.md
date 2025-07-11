# LocalHost Manager - Edge Extension

A Microsoft Edge extension that automatically detects and manages services running on localhost ports, making it easy to access your local development servers.

## Features

- **Automatic Port Detection**: Scans common development ports (3000, 8080, 5000, etc.)
- **Service Identification**: Recognizes popular frameworks and services:
  - React, Vue, Angular, Vite
  - Node.js/Express, Django, Flask, Rails
  - MongoDB, PostgreSQL, MySQL, Redis
  - Jupyter, Storybook, GraphQL Playground
  - And many more!
- **Quick Launch**: One-click to open services in new tabs
- **Custom Aliases**: Name your services for easy identification
- **Custom Port Support**: Add your own port numbers to scan
- **Auto-refresh**: Continuously monitors for new services

## Installation

1. Open the `generate-icons.html` file in a browser
2. Right-click each icon and save them to the `icons/` folder with the correct names
3. Open Edge and navigate to `edge://extensions/`
4. Enable "Developer mode" toggle
5. Click "Load unpacked"
6. Select the `localhost-manager-extension` folder

## Usage

1. Click the extension icon in your Edge toolbar
2. The extension will automatically scan for running services
3. Click "Open" to launch any detected service
4. Click the edit icon to add a custom name
5. Use the settings gear to:
   - Add custom ports
   - Enable/disable auto-scanning

## How It Works

The extension uses HTTP/HTTPS probing to detect active services on localhost. It:
1. Attempts connections to common development ports
2. Analyzes response headers and content
3. Identifies services based on unique patterns
4. Provides confidence levels (high/medium/low) for detection accuracy

## Limitations

- Can only detect HTTP/HTTPS services (not raw TCP services like databases)
- Some services may be detected as "Unknown Service" if they don't match known patterns
- Requires services to be accessible via localhost (not just 127.0.0.1)

## Privacy

This extension only scans localhost and never sends data outside your machine. All detection happens locally in your browser.

## Future Enhancements

- Native messaging support for full TCP port scanning
- More service detection patterns
- Port grouping by project
- Service start/stop integration
- Export/import settings