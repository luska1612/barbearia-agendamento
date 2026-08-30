# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands
- **Run the app**: Open `projeto-barbearia/index.html` in a web browser.
- **Build/Test**: No build process or automated test suite; verify changes by manually interacting with the site in a browser.

## Architecture and Structure
The project is a static frontend website for a barbershop scheduling system.

- `projeto-barbearia/index.html`: Main HTML structure.
- `projeto-barbearia/css/style.css`: All styling. Visual identity (colors, fonts) is managed via CSS variables in the `:root` block.
- `projeto-barbearia/js/script.js`: Core logic handling:
    - Calendar management and availability.
    - Scheduling validation (preventing conflicts).
    - Appointment management and retrieval via phone number.
    - Optional persistence using `localStorage` via the `BancoDeDados` object.

## Key Implementation Details
- **Scheduling Logic**: The system validates available time slots against existing appointments.
- **Persistence**: The `BancoDeDados` object in `script.js` manages data storage; check the "🔓" comments for enabling `localStorage` persistence.
- **Customization**:
    - Site content (name, address, services, barbers) is defined directly in `index.html`.
    - Visual themes are controlled by CSS variables in `style.css`.
