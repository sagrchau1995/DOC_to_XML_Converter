import React, { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

import axios from 'axios';

export const FileUpload: React.FC = () => {
    const [ files, setFiles ] = useState<File[]>([]);
    const [ progress, setProgress ] = useState<string>('');


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return;
        setProgress('Authenticating & requesting upload URLs...');

        try {
            let token = '';
            try {
                const session = await fetchAuthSession();
                token = session.tokens?.idToken?.toString() || '';
            } catch (e) {
                console.warn('Authentication disabled/missing, skipping token attachment.');
            }

            const fileUploadProps = await Promise.all(
                files.map(async (f) => {
                    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
                    const apiResponse = await fetch(`https://7lu0xmfn04.execute-api.us-east-1.amazonaws.com/presigned-url?fileName=${encodeURIComponent(f.name)}`, {
                        method: 'GET',
                        headers
                    });

                    if (!apiResponse.ok) {
                        throw new Error(`Failed to get presigned URL for ${f.name}`);
                    }

                    const { url, key } = await apiResponse.json();
                    return { file: f, url, s3Key: key };
                })
            );

            setProgress('Uploading files to S3...');
            for (let i = 0; i < fileUploadProps.length; i++) {
                const { file, url } = fileUploadProps[ i ];
                await axios.put(url, file, { headers: { 'Content-Type': file.type } });
            }

            setProgress(`Upload complete! The documents are being converted in the background. Note: Please check your output location for the resulting XML files.`);

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


        </div>
    );
};
