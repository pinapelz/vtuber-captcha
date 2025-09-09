import com.google.gson.Gson;
import com.pinapelz.Holodex;
import com.pinapelz.HolodexException;
import com.pinapelz.datatypes.Channel;
import com.pinapelz.query.ChannelQueryBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

import java.sql.*;


public class Main
{
    // Organization name -> formatted name
    private static Map<String, String> organizations = Map.of(
            "Hololive", "Hololive",
            "Nijisanji", "Nijisanji",
            "idol Corp", "Idol Corp",
            "Phase Connect", "Phase Connect",
            "VSpo", "VSPO!",
            "Independents", "Independents"
    );

    public static HashMap<String, String> readSettings() throws IOException {
        String settings = new String(Files.readAllBytes(Paths.get("secrets.json")));
        return new Gson().fromJson(settings, HashMap.class);
    }

    public static Connection createDBConnection(HashMap<String, String> settings) throws IOException, SQLException {
        String url = "jdbc:postgresql://"+settings.get("pg_host")+"/"+settings.get("pg_db");
        Properties props = new Properties();
        props.setProperty("user", settings.get("pg_user"));
        props.setProperty("password", settings.get("pg_password"));
        Connection conn = DriverManager.getConnection(url, props);
        return conn;
    }

    public static void main( String[] args ) throws IOException, HolodexException, SQLException {
        HashMap<String, String> settings = readSettings();
        Connection conn = createDBConnection(settings);
        System.out.println("Sucessfully connected to the database");
        Holodex holodex = new Holodex(settings.get("holodex_key"));
        Statement stmt = conn.createStatement();
        stmt.executeUpdate("DELETE FROM " + settings.get("pg_table"));
        stmt.close();
        System.out.println("Deleted all rows from the channels table");
        for (String org : organizations.keySet()) {
            ChannelQueryBuilder query = new ChannelQueryBuilder().setOrg(organizations.get(org)).setLimit(200);
            System.out.println("Getting channels for " + org);
            List<Channel> channels = holodex.getChannels(new ChannelQueryBuilder().setOrg(org));
            System.out.println("Got " + channels.size() + " channels");
            for (Channel channel : channels) {
                if(channel.english_name == null || channel.photo == null || channel.english_name.equals("")) {
                    System.out.println("Skipping " + channel.name);
                    continue;
                }
                if(channel.inactive){
                    System.out.println("Skipping inactive channel " + channel.english_name);
                    continue;
                }
                String insert = "INSERT INTO " + settings.get("pg_table") +
                        " (name, affiliation, image_url) " +
                        "VALUES  ('" + channel.english_name + "', '" + org+ "', '" + channel.photo + "')";
                System.out.println(insert);
                try{
                    stmt = conn.createStatement();
                    stmt.executeUpdate(insert);
                    stmt.close();
                } catch (SQLException e) {
                    System.out.println("Failed to insert " + channel.english_name);
                    System.out.println(e.getMessage());
                }
            }
        }



    }
}
