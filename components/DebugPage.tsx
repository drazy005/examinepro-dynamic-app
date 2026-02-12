
import React, { useState } from 'react';
import { api } from '../services/api';

const DebugPage: React.FC = () => {
    const [results, setResults] = useState<any>({});
    const [loading, setLoading] = useState(false);

    const runDiagnostics = async () => {
        setLoading(true);
        const log: any = {};

        try {
            log.me = await api.auth.me().catch(e => ({ error: e.message }));
            log.exams_admin = await api.exams.list().catch(e => ({ error: e.message }));
            log.exams_candidate = await api.exams.list('available').catch(e => ({ error: e.message }));
            log.submissions = await api.submissions.list().catch(e => ({ error: e.message }));
        } catch (e: any) {
            log.fatal_error = e.message;
        }

        setResults(log);
        setLoading(false);
    };

    return (
        <div className="p-10 bg-gray-100 min-h-screen">
            <h1 className="text-2xl font-bold mb-4">System One Diagnostic Tool</h1>
            <button
                onClick={runDiagnostics}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded mb-4 disabled:opacity-50"
            >
                {loading ? 'Running...' : 'Run Diagnostics'}
            </button>

            <pre className="bg-white p-4 rounded shadow overflow-auto max-h-[80vh] text-xs font-mono">
                {JSON.stringify(results, null, 2)}
            </pre>
        </div>
    );
};

export default DebugPage;
