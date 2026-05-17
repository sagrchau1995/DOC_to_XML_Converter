import React, { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { post, get } from 'aws-amplify/api';
import axios from 'axios';

export const FileUpload: React.FC = () => {
    const [ files, setFiles ] = useState<File[]>([]);
    const [ progress, setProgress ] = useState<string>('');
    const [ xmlLink, setXmlLink ] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return;
        setProgress('Authenticating & requesting upload URLs...');

        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            const fileUploadProps = await Promise.all(
                files.map(async (f) => {
                    const res = post({
                        apiName: 'DocumentApi',
                        path: '/presign',
                        options: {
                            body: { filename: f.name },
                            headers: { Authorization: token || '' }
                        }
                    });
                    const json = await res.response;
                    const { url, s3Key } = (await json.body.json()) as any;
                    return { file: f, url, s3Key };
                })
            );

            setProgress('Uploading files to S3...');
            for (let i = 0; i < fileUploadProps.length; i++) {
                const { file, url } = fileUploadProps[ i ];
                await axios.put(url, file, { headers: { 'Content-Type': file.type } });
            }

            setProgress('Triggering text extraction & XML merge pipeline...');
            const s3Keys = fileUploadProps.map(fp => fp.s3Key);
            const startRes = post({
                apiName: 'DocumentApi',
                path: '/start-job',
                options: {
                    body: { files: s3Keys, jobId: Date.now().toString() },
                    headers: { Authorization: token || '' }
                }
            });
            const startJson = await (await startRes.response).body.json() as any;
            const executionArn = startJson.executionArn;

            setProgress('Job started! Waiting for backend processing to finish...');

            // Poll for job completion
            const interval = setInterval(async () => {
                const statusRes = get({
                    apiName: 'DocumentApi',
                    path: '/job-status',
                    options: {
                        queryParams: { executionArn },
                        headers: { Authorization: token || '' }
                    }
                });
                const statusJson = await (await statusRes.response).body.json() as any;
                const status = statusJson.status;

                if (status === 'SUCCEEDED') {
                    setProgress('Job fully completed!');
                    const outputData = JSON.parse(statusJson.output);
                    setXmlLink(outputData.finalUrl);
                    clearInterval(interval);
                } else if (status === 'FAILED' || status === 'TIMED_OUT' || status === 'ABORTED') {
                    setProgress('Job failed!');
                    clearInterval(interval);
                }
            }, 5000);

        } catch (e) {
            console.error(e);
            setProgress('Error during process: ' + String(e));
        }
    };

    return (
        <div style={ { margin: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' } }>
            <h2>Upload Documents</h2>
            <input type="file" multiple accept=".pdf,image/*" onChange={ handleFileChange } />
            <button onClick={ handleUpload } disabled={ files.length === 0 }>
                Upload and Process files
            </button>

            { progress && <p>Status: { progress }</p> }

            { xmlLink && (
                <div style={ { marginTop: '1rem', padding: '1rem', border: '1px solid green' } }>
                    <h3>Process Complete</h3>
                    <p>Your combined XML report is available at:</p>
                    <a href={ xmlLink.replace('s3://', 'https://') } target="_blank" rel="noreferrer">{ xmlLink }</a>
                </div>
            ) }
        </div>
    );
};
