const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf8');

content = content.replace(
  `      addServer: (serverData) => {
        const id = uuidv4();
        const fund = get().calculateFund(serverData.entryDate);
        set((state) => ({
          servers: [...state.servers, { ...serverData, id, fund, status: serverData.status || 'APPROVED' }],
        }));
      },
      updateServer: (id, serverData) => {
        set((state) => ({
          servers: state.servers.map((server) => {
            if (server.id === id) {
              const updatedServer = { ...server, ...serverData };
              // Recalculate fund if entryDate changed
              if (serverData.entryDate !== undefined) {
                updatedServer.fund = get().calculateFund(updatedServer.entryDate);
              }
              return updatedServer;
            }
            return server;
          }),
        }));
      },`,
  `      addServer: (serverData) => {
        const id = uuidv4();
        const fund = serverData.fund || get().calculateFund(serverData.entryDate);
        set((state) => ({
          servers: [...state.servers, { ...serverData, id, fund, status: serverData.status || 'APPROVED' }],
        }));
      },
      updateServer: (id, serverData) => {
        set((state) => ({
          servers: state.servers.map((server) => {
            if (server.id === id) {
              const updatedServer = { ...server, ...serverData };
              // Recalculate fund if entryDate changed and fund was not explicitly provided in the update
              if (serverData.entryDate !== undefined && serverData.entryDate !== server.entryDate && serverData.fund === undefined) {
                updatedServer.fund = get().calculateFund(updatedServer.entryDate);
              }
              return updatedServer;
            }
            return server;
          }),
        }));
      }`
);

fs.writeFileSync('lib/store.ts', content);
