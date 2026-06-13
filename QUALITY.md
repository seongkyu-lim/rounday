# Quality Checklist

## Automated

- Run `npm test` for time calculation regression tests.
- Run `node --check app.js` for syntax validation.

## Manual

- Verify desktop width around 1440px.
- Verify tablet width around 1024px.
- Verify mobile width around 390px.
- Check keyboard flow: timeline card focus, Enter/Space edit, Escape cancel, Ctrl/Cmd+Enter submit.
- Check core buttons have accessible labels.
- Check print preview shows the schedule without editor controls.
