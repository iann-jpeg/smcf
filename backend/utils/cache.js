/**
 * Simple in-memory cache utility for API responses
 * Reduces database queries for frequently accessed data
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Set a cache entry
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get a cache entry
   * @param {string} key - Cache key
   * @returns {any} Cached value or null if expired/not found
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Delete a specific cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Delete cache entries matching a pattern
   * @param {string} pattern - String pattern to match
   */
  deletePattern(pattern) {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const totalEntries = this.cache.size;
    let validEntries = 0;
    let expiredEntries = 0;

    const now = Date.now();
    this.cache.forEach(entry => {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    });

    return {
      totalEntries,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));
    
    return expiredKeys.length;
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Auto cleanup every 10 minutes
setInterval(() => {
  const cleaned = cacheManager.cleanup();
  if (cleaned > 0) {
    console.log(`🧹 Cache cleanup: Removed ${cleaned} expired entries`);
  }
}, 10 * 60 * 1000);

/**
 * Cache middleware for Express routes
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} Express middleware
 */
export const cacheMiddleware = (ttl = 5 * 60 * 1000) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `${req.originalUrl}`;
    
    // Try to get from cache
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function(data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheManager.set(cacheKey, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Helper to invalidate cache for a specific pattern
 * Use this when data is updated
 */
export const invalidateCache = (pattern) => {
  cacheManager.deletePattern(pattern);
  console.log(`🗑️  Invalidated cache for pattern: ${pattern}`);
};

export default cacheManager;
