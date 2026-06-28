"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAllJobs = void 0;
const passExpiry_job_1 = require("./passExpiry.job");
const cacheRefresh_job_1 = require("./cacheRefresh.job");
const alertEscalation_job_1 = require("./alertEscalation.job");
const startAllJobs = () => {
    passExpiry_job_1.passExpiryJob.start();
    cacheRefresh_job_1.cacheRefreshJob.start();
    alertEscalation_job_1.alertEscalationJob.start();
};
exports.startAllJobs = startAllJobs;
//# sourceMappingURL=index.js.map