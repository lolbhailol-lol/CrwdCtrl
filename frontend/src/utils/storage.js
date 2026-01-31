/**
 * Unified Storage Utility - Mobile-Safe Storage with Fallback
 * 
 * Handles localStorage, sessionStorage, and memory fallback for mobile devices
 * that may have storage restrictions (private mode, quota exceeded, etc.)
 */

class UnifiedStorage {
    constructor() {
        this.memoryStore = new Map();
        this.storageType = this.detectStorageType();
    }

    /**
     * Detect which storage type is available
     * Priority: localStorage → sessionStorage → memory
     */
    detectStorageType() {
        try {
            // Test localStorage
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            console.log('✅ Using localStorage');
            return 'localStorage';
        } catch (e) {
            try {
                // Test sessionStorage
                const testKey = '__storage_test__';
                sessionStorage.setItem(testKey, testKey);
                sessionStorage.removeItem(testKey);
                console.log('⚠️ localStorage unavailable, using sessionStorage');
                return 'sessionStorage';
            } catch (e2) {
                console.warn('⚠️ All storage unavailable, using memory (data will be lost on refresh)');
                return 'memory';
            }
        }
    }

    /**
     * Get item from storage
     */
    getItem(key) {
        try {
            if (this.storageType === 'localStorage') {
                return localStorage.getItem(key);
            } else if (this.storageType === 'sessionStorage') {
                return sessionStorage.getItem(key);
            } else {
                return this.memoryStore.get(key) || null;
            }
        } catch (error) {
            console.error('Storage getItem error:', error);
            // Fallback to memory
            return this.memoryStore.get(key) || null;
        }
    }

    /**
     * Set item in storage
     */
    setItem(key, value) {
        try {
            if (this.storageType === 'localStorage') {
                localStorage.setItem(key, value);
            } else if (this.storageType === 'sessionStorage') {
                sessionStorage.setItem(key, value);
            } else {
                this.memoryStore.set(key, value);
            }
            return true;
        } catch (error) {
            console.error('Storage setItem error:', error);
            // Fallback to memory
            try {
                this.memoryStore.set(key, value);
                return true;
            } catch (e) {
                console.error('Memory storage also failed:', e);
                return false;
            }
        }
    }

    /**
     * Remove item from storage
     */
    removeItem(key) {
        try {
            if (this.storageType === 'localStorage') {
                localStorage.removeItem(key);
            } else if (this.storageType === 'sessionStorage') {
                sessionStorage.removeItem(key);
            } else {
                this.memoryStore.delete(key);
            }
            return true;
        } catch (error) {
            console.error('Storage removeItem error:', error);
            this.memoryStore.delete(key);
            return false;
        }
    }

    /**
     * Clear all items from storage
     */
    clear() {
        try {
            if (this.storageType === 'localStorage') {
                localStorage.clear();
            } else if (this.storageType === 'sessionStorage') {
                sessionStorage.clear();
            } else {
                this.memoryStore.clear();
            }
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            this.memoryStore.clear();
            return false;
        }
    }

    /**
     * Get JSON item from storage
     */
    getJSON(key) {
        const item = this.getItem(key);
        if (!item) return null;
        try {
            return JSON.parse(item);
        } catch (error) {
            console.error('Storage getJSON error:', error);
            return null;
        }
    }

    /**
     * Set JSON item in storage
     */
    setJSON(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            return this.setItem(key, jsonString);
        } catch (error) {
            console.error('Storage setJSON error:', error);
            return false;
        }
    }
}

// Export singleton instance
export const storage = new UnifiedStorage();

// Export class for testing
export { UnifiedStorage };
