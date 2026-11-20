const os = require("os");
const orig = os.networkInterfaces;
os.networkInterfaces = function () {
  try {
    return orig.apply(this, arguments);
  } catch {
    return {
      lo: [
        {
          address: "127.0.0.1",
          netmask: "255.0.0.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: true,
          cidr: "127.0.0.1/8",
        },
      ],
    };
  }
};
