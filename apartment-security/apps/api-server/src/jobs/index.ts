import { passExpiryJob } from './passExpiry.job';
import { cacheRefreshJob } from './cacheRefresh.job';
import { alertEscalationJob } from './alertEscalation.job';

export const startAllJobs = () => {
  passExpiryJob.start();
  cacheRefreshJob.start();
  alertEscalationJob.start();
};
