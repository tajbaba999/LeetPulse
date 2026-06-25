import pino from "pino";

const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    base: {
        env: process.env.NODE_ENV,
        service: 'dsa-tracker',
    },
});


export default logger;