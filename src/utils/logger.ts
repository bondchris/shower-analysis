import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp as string} [${level}]: ${message as string}`;
});

export const logger = winston.createLogger({
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), colorize(), logFormat),
  level: process.env["LOG_LEVEL"] ?? "info",
  transports: [new winston.transports.Console()]
});
