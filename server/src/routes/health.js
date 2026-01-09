export const registerHealthRoute = (app) => {
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });
};
