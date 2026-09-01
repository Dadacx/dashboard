const si = require('systeminformation');

async function test() {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const gpu = await si.graphics();
        console.log({
            cpuLoad: Math.round(cpu.currentLoad),
            memUsed: Math.round((mem.active / mem.total) * 100),
            gpuLoad: gpu.controllers.map(controller => ({
                model: controller.model,
                load: controller.utilizationGpu
            }))
        });
    } catch (e) {
        console.error('Błąd:', e.message);
    }
}

test()