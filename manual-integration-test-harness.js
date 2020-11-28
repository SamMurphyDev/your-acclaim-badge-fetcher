const { fetchBadges } = require('./dist/index');

(async () =>
  console.dir(
    await fetchBadges(process.argv[2], process.argv[3] === 'true' ?? false),
    {
      colors: true,
      depth: undefined,
    }
  ))();
