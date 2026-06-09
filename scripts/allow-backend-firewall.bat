@echo off
:: Run as Administrator — allows phone on same WiFi to reach backend on port 8080
netsh advfirewall firewall add rule name="CrwdCtrl Backend 8080" dir=in action=allow protocol=TCP localport=8080
echo Done. Phone can now reach http://YOUR_PC_IP:8080/api
