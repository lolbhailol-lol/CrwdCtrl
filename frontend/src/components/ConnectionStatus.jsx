import React, { useState, useEffect } from 'react';
import { API_BASE_URL, resolveUrl } from '../services/api/client';

const ConnectionStatus = () => {
    const [connectionStatus, setConnectionStatus] = useState({
        testing: false,
        results: [],
        error: null
    });

    const [manualTest, setManualTest] = useState({
        endpoint: '/health',
        method: 'GET',
        result: null,
        loading: false
    });

    useEffect(() => {
        // Component mounted - ready for connection testing
        console.log('ConnectionStatus component mounted');
    }, []);

    const runConnectionTest = async () => {
        setConnectionStatus(prev => ({ ...prev, testing: true, error: null }));

        try {
            const tests = [
                { test: 'Backend Health Check', endpoint: '/health' },
                { test: 'API Base Connection', endpoint: '/' }
            ];

            const results = [];
            for (const testItem of tests) {
                try {
                    const response = await fetch(resolveUrl(testItem.endpoint));
                    results.push({
                        test: testItem.test,
                        status: response.ok ? 'PASS' : 'FAIL',
                        response: { status: response.status }
                    });
                } catch (error) {
                    results.push({
                        test: testItem.test,
                        status: 'FAIL',
                        error: error.message
                    });
                }
            }

            setConnectionStatus({
                testing: false,
                results,
                error: null
            });
        } catch (error) {
            setConnectionStatus({
                testing: false,
                results: [],
                error: error.message
            });
        }
    };

    const runManualTest = async () => {
        setManualTest(prev => ({ ...prev, loading: true, result: null }));

        try {
            const url = resolveUrl(manualTest.endpoint);

            const response = await fetch(url, {
                method: manualTest.method,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            setManualTest(prev => ({
                ...prev,
                loading: false,
                result: {
                    status: response.status,
                    success: response.ok,
                    data: data,
                    url: url
                }
            }));
        } catch (error) {
            setManualTest(prev => ({
                ...prev,
                loading: false,
                result: {
                    error: error.message,
                    url: resolveUrl(manualTest.endpoint)
                }
            }));
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'PASS':
                return <span className="text-green-500">✅</span>;
            case 'FAIL':
                return <span className="text-red-500">❌</span>;
            default:
                return <span className="text-yellow-500">⏳</span>;
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                Frontend ↔ Backend Connection Status
            </h2>

            {/* Environment Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Environment Configuration</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <strong>API Base URL:</strong> {API_BASE_URL}
                    </div>
                    <div>
                        <strong>Environment:</strong> {import.meta.env.MODE}
                    </div>
                    <div>
                        <strong>Production Mode:</strong> {import.meta.env.PROD ? 'Yes' : 'No'}
                    </div>
                    <div>
                        <strong>Current Origin:</strong> {window.location.origin}
                    </div>
                </div>
            </div>

            {/* Auto Tests */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Automated Connection Tests</h3>
                    <button
                        onClick={runConnectionTest}
                        disabled={connectionStatus.testing}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {connectionStatus.testing ? 'Testing...' : 'Run Tests'}
                    </button>
                </div>

                {connectionStatus.results.length > 0 && (
                    <div className="space-y-2">
                        {connectionStatus.results.map((result, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex items-center space-x-2">
                                    {getStatusIcon(result.status)}
                                    <span className="font-medium">{result.test}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {result.status === 'PASS' ? (
                                        <span className="text-green-600">
                                            Status: {result.response?.status}
                                        </span>
                                    ) : (
                                        <span className="text-red-600">{result.error}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {connectionStatus.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-800">Error: {connectionStatus.error}</p>
                    </div>
                )}
            </div>

            {/* Manual Test */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Manual API Test</h3>
                <div className="flex space-x-4 mb-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">Endpoint:</label>
                        <input
                            type="text"
                            value={manualTest.endpoint}
                            onChange={(e) => setManualTest(prev => ({ ...prev, endpoint: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="/health"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Method:</label>
                        <select
                            value={manualTest.method}
                            onChange={(e) => setManualTest(prev => ({ ...prev, method: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">&nbsp;</label>
                        <button
                            onClick={runManualTest}
                            disabled={manualTest.loading}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        >
                            {manualTest.loading ? 'Testing...' : 'Test'}
                        </button>
                    </div>
                </div>

                {manualTest.result && (
                    <div className="p-4 bg-gray-50 rounded border">
                        <div className="mb-2">
                            <strong>URL:</strong> {manualTest.result.url}
                        </div>
                        {manualTest.result.error ? (
                            <div className="text-red-600">
                                <strong>Error:</strong> {manualTest.result.error}
                            </div>
                        ) : (
                            <div>
                                <div className="mb-2">
                                    <strong>Status:</strong>
                                    <span className={manualTest.result.success ? 'text-green-600' : 'text-red-600'}>
                                        {manualTest.result.status} {manualTest.result.success ? '(Success)' : '(Error)'}
                                    </span>
                                </div>
                                <div>
                                    <strong>Response:</strong>
                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                        {JSON.stringify(manualTest.result.data, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Connection Tips */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-semibold text-blue-800 mb-2">Connection Troubleshooting Tips:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Make sure the backend server is running on port 8080</li>
                    <li>• Check that the frontend is configured to connect to http://localhost:8080/api</li>
                    <li>• Verify CORS is properly configured in the backend</li>
                    <li>• Check the browser console for any error messages</li>
                    <li>• Ensure MongoDB is connected in the backend</li>
                </ul>
            </div>
        </div>
    );
};

export default ConnectionStatus;