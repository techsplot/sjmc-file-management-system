interface ApiOptions extends RequestInit {
    requireAuth?: boolean;
}

export async function apiCall(endpoint: string, options: ApiOptions = {}) {
    const { requireAuth = true, ...fetchOptions } = options;
    
    if (requireAuth) {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        fetchOptions.headers = {
            ...fetchOptions.headers,
            'Authorization': `Bearer ${token}`,
        };
    }

    const response = await fetch(`${endpoint}`, fetchOptions);
    
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.reload();
        }
        throw new Error(`API call failed: ${response.statusText}`);
    }

    return response.json();
}