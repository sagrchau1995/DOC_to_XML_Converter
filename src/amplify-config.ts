import { Amplify } from 'aws-amplify';

// These values will be printed by the CDK deployment.
// User will manually replace these strings with the CDK Output.
export const amplifyConfig = {
    Auth: {
        Cognito: {
            userPoolId: 'USER_POOL_ID_PLACEHOLDER',
            userPoolClientId: 'APP_CLIENT_ID_PLACEHOLDER',
        }
    },
    API: {
        REST: {
            DocumentApi: {
                endpoint: 'API_URL_PLACEHOLDER',
                region: 'us-east-1',
            }
        }
    }
};

Amplify.configure(amplifyConfig);
