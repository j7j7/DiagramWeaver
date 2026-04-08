import packageJson from '../../package.json';
import buildInfo from './build-version.json';

export const APP_SEMVER = packageJson.version;
export const APP_BUILD = buildInfo.build;
/** e.g. `0.1.0 (build 42)` */
export const APP_VERSION_LABEL = `${APP_SEMVER} (build ${APP_BUILD})`;
