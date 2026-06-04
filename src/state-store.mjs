// src/state-store.mjs

class StateStore {
    constructor() {
        this.state = {
            txHistory: [],
            budgetGroups: [],
            recurringItems: [],
            profiles: [],
            uiState: {
                draftTransaction: null
            }
        };
        this.subscribers = {};
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name (e.g., 'txHistory:updated')
     * @param {Function} callback - Function to call when event is published
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.subscribers[event]) {
            this.subscribers[event] = [];
        }
        this.subscribers[event].push(callback);
        
        return () => {
            this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Publish an event to all subscribers
     * @param {string} event - Event name
     * @param {any} data - Data to pass to callbacks
     */
    publish(event, data) {
        if (this.subscribers[event]) {
            this.subscribers[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in subscriber for event ${event}:`, error);
                }
            });
        }
    }

    /**
     * Get a piece of state
     * @param {string} key - State key
     * @returns {any}
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Set a piece of state and optionally publish an event
     * @param {string} key - State key
     * @param {any} value - New value
     * @param {boolean} [silent=false] - If true, do not publish update event
     */
    set(key, value, silent = false) {
        this.state[key] = value;
        if (!silent) {
            this.publish(`${key}:updated`, value);
        }
    }

    /**
     * Save specific state keys to LocalStorage to act as offline cache
     * Limits history to the last 6 months to prevent Quota Exceeded.
     */
    saveToCache() {
        try {
            if (typeof localStorage === 'undefined') return;
            // Filter history to last 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            
            const historyToCache = (this.state.txHistory || []).filter(tx => {
                const txDate = new Date(tx.timestamp || tx.date); // Handle both formats if possible
                return txDate >= sixMonthsAgo;
            });

            const cacheData = {
                txHistory: historyToCache,
                budgetGroups: this.state.budgetGroups,
                recurringItems: this.state.recurringItems,
                profiles: this.state.profiles,
                cachedAt: new Date().toISOString()
            };
            localStorage.setItem('app_state_cache', JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to save state to cache (Quota exceeded?):', error);
        }
    }

    /**
     * Load state from LocalStorage cache
     */
    loadFromCache() {
        try {
            if (typeof localStorage === 'undefined') return false;
            const cached = localStorage.getItem('app_state_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                this.state = { ...this.state, ...parsed };
                // Publish events for loaded data
                Object.keys(parsed).forEach(key => {
                    if (key !== 'cachedAt') {
                        this.publish(`${key}:updated`, this.state[key]);
                    }
                });
                return true;
            }
        } catch (error) {
            console.error('Failed to load state from cache:', error);
        }
        return false;
    }
}

// Export a singleton instance
export const stateStore = new StateStore();
