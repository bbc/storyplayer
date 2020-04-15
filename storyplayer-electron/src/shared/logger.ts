const log = (text: any) => {
    // eslint-disable-next-line no-console
    console.log(text);
};

module.exports = {
    error: log,
    warn: log,
    info: log,
}
