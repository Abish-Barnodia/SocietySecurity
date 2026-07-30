import { passExpiryJob } from './passExpiry.job';
import { cacheRefreshJob } from './cacheRefresh.job';
import { alertEscalationJob } from './alertEscalation.job';
import { visitorApprovalTimeoutJob } from './visitorApprovalTimeout.job';

export const startAllJobs = () => {
  passExpiryJob.start();
  cacheRefreshJob.start();
  alertEscalationJob.start();
  visitorApprovalTimeoutJob.start();
};
