import pinoLoki from "pino-loki";
import { env } from "../env.js";

const lokiTransport = pinoLoki({
    batching: {
        maxBufferSize: 10000,
        interval: 5000,
    },
    host: 'http://loki:3100',
    basicAuth: {
        username: '',
        password: '',
    },
    labels: { service: 'dsa-tracker' },
});


export default lokiTransport;
