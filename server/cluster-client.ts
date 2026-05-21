import { Socket } from 'net';
import { storage } from './storage';
import { broadcast } from './websocket';

interface ClusterConfig {
  fqdn: string;
  port: number;
  loginCallsign: string;
  enabled: boolean;
  pointsPerSpot: number;
}

interface SpotData {
  spotter: string;
  frequency: string;
  spotted: string;
  comment: string;
  time: string;
}

class ClusterClient {
  private socket: Socket | null = null;
  private config: ClusterConfig | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private isShuttingDown: boolean = false;
  private isRestarting: boolean = false;
  private hasLoggedIn: boolean = false;
  private memberCache: Set<string> = new Set();
  private eligibleMemberCache: Map<string, number> = new Map(); // callsign -> expiration year
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly KEEP_ALIVE_INTERVAL = 90 * 1000; // 90 seconds
  private readonly SOCKET_TIMEOUT = 5 * 60 * 1000; // 5 minutes idle timeout
  private lastDataReceived: number = 0;

  async start() {
    try {
      // Load cluster configuration
      await this.loadConfig();
      
      if (!this.config?.enabled) {
        console.log('DX Cluster client disabled in configuration');
        return;
      }

      // Load member cache
      await this.refreshMemberCache();
      
      // Connect to cluster
      this.connect();
    } catch (error) {
      console.error('Failed to start cluster client:', error);
      this.scheduleReconnect();
    }
  }

  async loadConfig() {
    const enabledConfig = await storage.getScoringConfig('cluster_enabled');
    const fqdnConfig = await storage.getScoringConfig('cluster_fqdn');
    const portConfig = await storage.getScoringConfig('cluster_port');
    const callsignConfig = await storage.getScoringConfig('cluster_login_callsign');
    const pointsConfig = await storage.getScoringConfig('cheerleader_points_per_spot');

    this.config = {
      enabled: enabledConfig?.value === 'true',
      fqdn: fqdnConfig?.value || 'dxc.w6cua.org',
      port: parseInt(portConfig?.value || '7300', 10),
      loginCallsign: callsignConfig?.value || 'AJ1I',
      pointsPerSpot: parseInt(pointsConfig?.value || '100', 10),
    };

    console.log('Cluster configuration loaded:', {
      enabled: this.config.enabled,
      fqdn: this.config.fqdn,
      port: this.config.port,
      loginCallsign: this.config.loginCallsign,
      pointsPerSpot: this.config.pointsPerSpot,
    });
  }

  async refreshMemberCache() {
    try {
      const now = Date.now();
      if (now - this.lastCacheUpdate < this.CACHE_TTL) {
        return; // Cache still valid
      }

      const allMembers = await storage.getAllActiveMembers();
      this.memberCache.clear();
      this.eligibleMemberCache.clear();

      const currentYear = new Date().getFullYear();

      for (const member of allMembers) {
        this.memberCache.add(member.callsign.toUpperCase());
        
        // Check if member has valid dues for current year
        if (member.duesExpiration) {
          const parts = member.duesExpiration.split('/');
          if (parts.length === 3) {
            const expirationYear = parseInt(parts[2], 10);
            if (!isNaN(expirationYear) && expirationYear >= currentYear) {
              this.eligibleMemberCache.set(member.callsign.toUpperCase(), expirationYear);
            }
          }
        }
      }

      this.lastCacheUpdate = now;
      console.log(`Member cache refreshed: ${this.memberCache.size} total, ${this.eligibleMemberCache.size} eligible for ${currentYear}`);
    } catch (error) {
      console.error('Failed to refresh member cache:', error);
    }
  }

  connect() {
    if (!this.config || this.isShuttingDown) return;

    console.log(`Connecting to DX Cluster at ${this.config.fqdn}:${this.config.port}...`);

    this.socket = new Socket();
    let buffer = '';

    this.socket.on('connect', () => {
      console.log('✓ Connected to DX Cluster');
      this.isConnected = true;
      this.hasLoggedIn = false; // Reset login flag for this new connection
      this.lastDataReceived = Date.now();
      
      if (this.socket) {
        // Enable TCP-level keep-alive
        this.socket.setKeepAlive(true, 60000); // 60 second TCP keep-alive
        
        // Set socket timeout for stalled connections
        this.socket.setTimeout(this.SOCKET_TIMEOUT);
      }
      
      broadcast('cluster:status', { connected: true });
      this.startKeepAlive();
    });

    this.socket.on('data', (data) => {
      this.lastDataReceived = Date.now();
      
      // Reset socket timeout on every data receipt to prevent false "stalled" triggers
      if (this.socket) {
        this.socket.setTimeout(this.SOCKET_TIMEOUT);
      }
      
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        this.handleLine(line.trim());
      }
    });

    this.socket.on('close', () => {
      console.log('✗ Disconnected from DX Cluster');
      this.isConnected = false;
      this.socket = null;
      this.stopKeepAlive();
      broadcast('cluster:status', { connected: false });
      
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('timeout', () => {
      console.warn('DX Cluster socket timeout - connection may be stalled');
      if (this.socket) {
        this.socket.destroy();
      }
    });

    this.socket.on('error', (error) => {
      console.error('DX Cluster connection error:', error.message);
      this.stopKeepAlive();
      if (this.socket) {
        this.socket.destroy();
      }
    });

    this.socket.connect(this.config.port, this.config.fqdn);
  }

  handleLine(line: string) {
    // Debug: Log all incoming lines for the next 2 minutes after connection
    const timeSinceConnect = Date.now() - this.lastDataReceived;
    if (timeSinceConnect < 120000 || line.startsWith('DX de')) {
      console.log(`[Cluster RX] ${line}`);
    }

    // Login prompt - only match the actual prompt, not lines containing "login:" or "call"
    const trimmedLine = line.trim().toLowerCase();
    if (trimmedLine === 'please enter your call:' || 
        trimmedLine === 'login:' || 
        (trimmedLine.startsWith('please') && trimmedLine.includes('call'))) {
      
      // Only send login once per connection to prevent duplicate logins
      if (!this.hasLoggedIn && this.socket && this.config) {
        this.hasLoggedIn = true;
        this.socket.write(`${this.config.loginCallsign}\n`);
        console.log(`Logged in as ${this.config.loginCallsign}`);
      }
      return;
    }

    // Parse DX spot
    const spot = this.parseSpot(line);
    if (spot) {
      this.processSpot(spot);
    }
  }

  /**
   * Normalize callsign by extracting base callsign from portable/DX formats
   * Examples:
   *   N2WQ/1 -> N2WQ
   *   W1UE/qrp -> W1UE
   *   V47/K5ZD -> K5ZD
   *   LZ/K1XM/p -> K1XM
   */
  normalizeCallsign(callsign: string): string {
    if (!callsign.includes('/')) {
      return callsign;
    }

    // Split by slash to get all parts
    const parts = callsign.split('/');
    
    // Ham radio callsign pattern: typically 1-2 letters, a digit, then 1-4 letters
    // Example: N2WQ, K1XM, W1UE, AA1K, VE3XYZ
    const callsignPattern = /^[A-Z]{1,2}\d[A-Z]{1,4}$/;
    
    // Find the part that matches the standard callsign pattern
    for (const part of parts) {
      if (callsignPattern.test(part)) {
        return part;
      }
    }
    
    // Fallback: return the longest part (likely the base callsign)
    return parts.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );
  }

  parseSpot(line: string): SpotData | null {
    // DX spot format: "DX de SPOTTER: FREQUENCY SPOTTED COMMENT TIME [OPTIONAL]"
    // Example: "DX de K1AR:     14.025 WK1O        Great signal!     1830Z"
    // Example: "DX de KA1R:     21274.5  W2A       USB               FN13 1307Z FN65"
    const spotPattern = /^DX de\s+([A-Z0-9/-]+):\s+(\d+\.?\d*)\s+([A-Z0-9/-]+)\s+(.*?)\s+(\d{4}Z)/i;
    const match = line.match(spotPattern);

    if (!match) {
      return null;
    }

    return {
      spotter: match[1].trim().toUpperCase(),
      frequency: match[2].trim(),
      spotted: match[3].trim().toUpperCase(),
      comment: match[4].trim(),
      time: match[5].trim(),
    };
  }

  async processSpot(spot: SpotData) {
    try {
      // Refresh cache if needed
      await this.refreshMemberCache();

      // Filter 0: Drop RBN spots early (SSID with # symbol)
      // Examples: RBN#12345, SKIMMER#77, etc.
      if (spot.spotter.includes('#')) {
        // RBN spot, drop immediately
        return;
      }

      // Filter 1: Normalize callsigns to handle portable/DX formats
      const normalizedSpotter = this.normalizeCallsign(spot.spotter);
      const normalizedSpotted = this.normalizeCallsign(spot.spotted);

      // Filter 2: Spotter must be eligible club member (valid dues)
      if (!this.eligibleMemberCache.has(normalizedSpotter)) {
        return;
      }

      // Filter 3: Spotted station must be any club member
      if (!this.memberCache.has(normalizedSpotted)) {
        return;
      }

      // Award cheerleader points (use normalized callsign for database)
      await this.awardCheerleaderPoints(normalizedSpotter, normalizedSpotted, spot.frequency);

      console.log(`✓ Cheerleader spot: ${spot.spotter} spotted ${spot.spotted} on ${spot.frequency}`);
    } catch (error) {
      console.error('Error processing spot:', error);
    }
  }

  async awardCheerleaderPoints(spotterCallsign: string, spottedCallsign: string, frequency: string) {
    try {
      const currentYear = new Date().getFullYear();
      
      // Get points per spot configuration
      const pointsConfig = await storage.getScoringConfig('cheerleader_points_per_spot');
      const pointsPerSpot = parseInt(pointsConfig?.value || '100', 10);

      // Increment cheerleader points for this member/year
      await storage.incrementCheerleaderPoints(spotterCallsign, currentYear, pointsPerSpot, spottedCallsign, frequency);

      // Broadcast update
      broadcast('cheerleader:spot', {
        spotter: spotterCallsign,
        spotted: spottedCallsign,
        frequency,
        year: currentYear,
        pointsAwarded: pointsPerSpot,
      });
    } catch (error) {
      console.error('Error awarding cheerleader points:', error);
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.socket && this.isConnected && this.socket.writable && !this.socket.destroyed) {
        try {
          // Send CRLF (proper telnet line ending)
          this.socket.write('\r\n');
        } catch (error: any) {
          console.error('Keep-alive write failed:', error.message);
          // Let the error handler clean up
        }
      }
    }, this.KEEP_ALIVE_INTERVAL);
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log('Reconnecting to DX Cluster in 60 seconds...');
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 60 * 1000); // 1 minute
  }

  stop() {
    this.isShuttingDown = true;
    
    this.stopKeepAlive();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.isConnected = false;
    console.log('DX Cluster client stopped');
  }

  async restart() {
    // Prevent concurrent restarts
    if (this.isRestarting) {
      console.log('Restart already in progress, skipping duplicate restart');
      return;
    }

    this.isRestarting = true;
    try {
      console.log('Restarting DX Cluster client...');
      this.stop();
      this.isShuttingDown = false;
      await this.start();
    } finally {
      // Add slight delay before allowing next restart to prevent rapid-fire restarts
      setTimeout(() => {
        this.isRestarting = false;
      }, 1000);
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      config: this.config,
      membersCached: this.memberCache.size,
      eligibleMembersCached: this.eligibleMemberCache.size,
    };
  }
}

export const clusterClient = new ClusterClient();
