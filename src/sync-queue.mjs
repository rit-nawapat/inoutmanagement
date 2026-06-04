// src/sync-queue.mjs

export class SyncQueueManager {
    constructor(apiClient, stateStore) {
        this.apiClient = apiClient;
        this.stateStore = stateStore;
        this.queueKey = 'app_sync_queue';
        this.isSyncing = false;
        
        // Listen to online events to trigger sync
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.sync());
        }
    }

    /**
     * Get the current queue from LocalStorage
     * @returns {Array}
     */
    getQueue() {
        try {
            const queueStr = localStorage.getItem(this.queueKey);
            return queueStr ? JSON.parse(queueStr) : [];
        } catch (e) {
            console.error('Failed to parse sync queue', e);
            return [];
        }
    }

    /**
     * Save the queue to LocalStorage
     * @param {Array} queue 
     */
    saveQueue(queue) {
        localStorage.setItem(this.queueKey, JSON.stringify(queue));
    }

    /**
     * Add an operation to the queue
     * @param {Object} operation - { action: 'addTransaction', data: {...}, uuid: '...', timestamp: 12345 }
     */
    enqueue(operation) {
        if (!operation.timestamp) {
            operation.timestamp = Date.now();
        }
        
        let queue = this.getQueue();
        queue.push(operation);
        
        // Request coalescing (compress queue before saving)
        queue = this.coalesceQueue(queue);
        
        this.saveQueue(queue);
        
        if (this.stateStore) {
            this.stateStore.publish('sync:queued', { queueLength: queue.length });
        }
        
        // Attempt to sync immediately if online
        if (navigator.onLine) {
            this.sync();
        }
    }

    /**
     * Compress the queue to avoid redundant API calls
     * @param {Array} queue 
     * @returns {Array} Compressed queue
     */
    coalesceQueue(queue) {
        const coalesced = [];
        const uuidMap = new Map();

        // Process from oldest to newest
        for (const op of queue) {
            const uuid = op.id || (op.data && op.data.id) || op.uuid;
            
            if (!uuid) {
                // If no UUID (e.g., legacy or unrelated operation), keep it as is
                coalesced.push(op);
                continue;
            }

            const existingIndex = uuidMap.get(uuid);
            const opAction = op.action || '';
            const isAdd = opAction === 'add' || opAction.startsWith('add');
            const isEdit = opAction === 'edit' || opAction.startsWith('edit');
            const isDelete = opAction === 'delete' || opAction.startsWith('delete');

            if (existingIndex !== undefined) {
                const existingOp = coalesced[existingIndex];
                const existingAction = existingOp.action || '';
                const existingIsAdd = existingAction === 'add' || existingAction.startsWith('add');
                const existingIsEdit = existingAction === 'edit' || existingAction.startsWith('edit');
                
                // If it was added, then edited -> Merge data and keep as 'add'
                if (existingIsAdd && isEdit) {
                    if (existingOp.data && op.data) existingOp.data = { ...existingOp.data, ...op.data };
                    else Object.assign(existingOp, op, { action: existingOp.action, timestamp: Math.max(existingOp.timestamp, op.timestamp) });
                }
                // If it was added, then deleted -> Remove it entirely from queue
                else if (existingIsAdd && isDelete) {
                    coalesced[existingIndex] = null; // Mark for removal
                    uuidMap.delete(uuid);
                }
                // If it was edited, then edited again -> Merge data, keep as 'edit'
                else if (existingIsEdit && isEdit) {
                    if (existingOp.data && op.data) existingOp.data = { ...existingOp.data, ...op.data };
                    else Object.assign(existingOp, op, { action: existingOp.action, timestamp: Math.max(existingOp.timestamp, op.timestamp) });
                }
                // If it was edited, then deleted -> Change to 'delete'
                else if (existingIsEdit && isDelete) {
                    Object.assign(existingOp, op);
                }
                // Otherwise, just replace it or push new (fallback)
                else {
                    coalesced[existingIndex] = op;
                }
            } else {
                // New UUID operation
                coalesced.push(op);
                uuidMap.set(uuid, coalesced.length - 1);
            }
        }

        return coalesced.filter(op => op !== null);
    }

    /**
     * Sync the queue to the backend via Batch API
     */
    async sync() {
        if (this.isSyncing || !navigator.onLine) return;
        
        let queue = this.getQueue();
        if (queue.length === 0) return;

        this.isSyncing = true;
        
        // Notify UI that sync is in progress
        if (this.stateStore) {
            this.stateStore.publish('sync:started', { queueLength: queue.length });
        }

        try {
            // Send everything as a batch
            const batchPayload = {
                action: 'batch',
                operations: queue
            };

            const response = await this.apiClient.postJson(batchPayload);
            
            if (response && (response.success || response.status === 'Success')) {
                // Sync successful, clear queue
                this.saveQueue([]);
                if (this.stateStore) {
                    this.stateStore.publish('sync:success', { syncedCount: queue.length });
                }
                
                // Automatically fetch fresh data to reconcile state (Cache Invalidation)
                // App.js or API layer should listen to sync:success and do a fetch with cache-buster
            } else {
                throw new Error(response ? response.error : 'Unknown batch error');
            }
        } catch (error) {
            console.error('Sync failed, will retry later:', error);
            if (this.stateStore) {
                this.stateStore.publish('sync:failed', { error: error.message });
            }
        } finally {
            this.isSyncing = false;
        }
    }
}

export let syncQueueInstance = null;
export function initSyncQueue(apiClient, stateStore) {
    syncQueueInstance = new SyncQueueManager(apiClient, stateStore);
    return syncQueueInstance;
}

