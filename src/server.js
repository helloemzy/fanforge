const app = require('./app');

const port = Number.parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
  console.log(`FanForge listening on http://localhost:${port}`);
});
