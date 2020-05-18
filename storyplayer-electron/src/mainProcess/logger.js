const log = (text) => {
    // eslint-disable-next-line no-console
    console.log(text);
};

module.exports = {
    info: log,
    warn: log,
    debug: log,
    error: log,
}
