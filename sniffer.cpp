#include <arpa/inet.h> // For ip formatting
#include <iostream>
#include <net/ethernet.h> // For ether_header
#include <netinet/ip.h>  // For ip struct
#include <netinet/tcp.h> // For tcp struct
#include <netinet/udp.h> // For udp struct
#include <pcap/pcap.h>
#include <ifaddrs.h>
#include <net/if_dl.h>
#include <string.h>
using namespace std;

void print_my_mac_address(const char* target_interface) {
    struct ifaddrs *ifap, *ifaptr;
    
    if (getifaddrs(&ifap) == 0) {
        for (ifaptr = ifap; ifaptr != nullptr; ifaptr = ifaptr->ifa_next) {
            if (ifaptr->ifa_addr != nullptr && ifaptr->ifa_addr->sa_family == AF_LINK) {
                if (strcmp(ifaptr->ifa_name, target_interface) == 0) {
                    struct sockaddr_dl *sdl = (struct sockaddr_dl *)ifaptr->ifa_addr;
                    unsigned char *mac = (unsigned char *)LLADDR(sdl);
                    
                    printf("\nMy Host MAC Address (%s): %02x:%02x:%02x:%02x:%02x:%02x\n\n", 
                           target_interface, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
                    break;
                }
            }
        }
        freeifaddrs(ifap);
    } else {
        cerr << "Failed to get network interfaces." << endl;
    }
}


void packet_handler(u_char *user_data, const struct pcap_pkthdr *pkthdr, const u_char *packet) {
  struct ether_header *eth_header = (struct ether_header *)packet;

  char dst_mac[18], src_mac[18];
  snprintf(dst_mac, sizeof(dst_mac), "%02x:%02x:%02x:%02x:%02x:%02x",
           eth_header->ether_dhost[0], eth_header->ether_dhost[1],
           eth_header->ether_dhost[2], eth_header->ether_dhost[3],
           eth_header->ether_dhost[4], eth_header->ether_dhost[5]);
  snprintf(src_mac, sizeof(src_mac), "%02x:%02x:%02x:%02x:%02x:%02x",
           eth_header->ether_shost[0], eth_header->ether_shost[1],
           eth_header->ether_shost[2], eth_header->ether_shost[3],
           eth_header->ether_shost[4], eth_header->ether_shost[5]);

  // Start building JSON output
  char src_ip[INET_ADDRSTRLEN] = "";
  char dst_ip[INET_ADDRSTRLEN] = "";
  const char *protocol = "OTHER";
  int src_port = 0, dst_port = 0;

  if (ntohs(eth_header->ether_type) == ETHERTYPE_IP) {
    struct ip *ip_header = (struct ip *)(packet + sizeof(struct ether_header));
    int ip_header_length = ip_header->ip_hl * 4;

    strncpy(src_ip, inet_ntoa(ip_header->ip_src), sizeof(src_ip));
    strncpy(dst_ip, inet_ntoa(ip_header->ip_dst), sizeof(dst_ip));

    const u_char *layer4_payload = packet + sizeof(struct ether_header) + ip_header_length;

    if (ip_header->ip_p == IPPROTO_TCP) {
      struct tcphdr *tcp_header = (struct tcphdr *)layer4_payload;
      protocol = "TCP";
      src_port = ntohs(tcp_header->th_sport);
      dst_port = ntohs(tcp_header->th_dport);
    } else if (ip_header->ip_p == IPPROTO_UDP) {
      struct udphdr *udp_header = (struct udphdr *)layer4_payload;
      protocol = "UDP";
      src_port = ntohs(udp_header->uh_sport);
      dst_port = ntohs(udp_header->uh_dport);
    }
  }

  // Output one JSON line per packet
  printf("{\"src_mac\":\"%s\",\"dst_mac\":\"%s\",\"src_ip\":\"%s\",\"dst_ip\":\"%s\","
         "\"protocol\":\"%s\",\"src_port\":%d,\"dst_port\":%d,\"length\":%d}\n",
         src_mac, dst_mac, src_ip, dst_ip, protocol, src_port, dst_port, pkthdr->len);
  fflush(stdout);
}

int main() {
  char errbuf[PCAP_ERRBUF_SIZE];
  pcap_t *handle;

  // device stores the address of the first char of
  // the string literal "en0"
  const char *device = "en0";

  // Print my mac address
  print_my_mac_address(device);
  
  cout << "Starting capture on interface: " << device << endl;

  // Open the device for sniffing
  // device => network interface to capture from
  // 65535 => max byte to capture from each packet
  // 1 => enable promiscuous mode
  // 1000ms => packet capture timeout
  // errbuf stores the error message
  handle = pcap_open_live(device, 65535, 1, 1000, errbuf);

  if (handle == nullptr) {
    cerr << "Couldn't open device " << device << ": " << errbuf << endl;
    return 1;
  }

  // start a continuous capture loop (0 = infinite)
  pcap_loop(handle, 0, packet_handler, nullptr);

  // Clean up
  pcap_close(handle);
  cout << "Capture complete..." << endl;
  return 0;
}