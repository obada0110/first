package lab.maxeditor.transfer;

import android.app.Activity;
import android.os.Bundle;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.*;
import integration.Port;

/** Independent fixture host: no permissions, URI grants, DB, or production classes. */
public final class Lab extends Activity {
    private Port port; private long revision; private TextView status;
    private JSONObject call(String method, Object data) throws Exception {
        JSONObject req=new JSONObject().put("api",1).put("method",method).put("data",data);
        return new JSONObject(port.call(req.toString()));
    }
    private String asset(String name) throws Exception {
        try(InputStream in=getAssets().open(name); ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return out.toString("UTF-8");
        }
    }
    private void action(String id) {
        try {
            JSONObject cmd=new JSONObject().put("expectedRevision",revision);
            if(id.equals("order"))cmd.put("op","order").put("ids",new JSONArray("[\"overlay\",\"title\"]"));
            else if(id.equals("key"))cmd.put("op","putKey").put("id","title").put("atUs",750000).put("value",new JSONObject("{\"x\":77,\"y\":50,\"w\":100,\"h\":100,\"angle\":0,\"opacity\":100,\"cropX\":0,\"cropY\":0}"));
            else throw new IllegalArgumentException();
            JSONObject result=call("edit",cmd);if(!result.getBoolean("ok"))throw new IOException(result.toString());revision=result.getLong("revision");
            JSONObject snap=call("snapshot",JSONObject.NULL);Files.write(new File(getFilesDir(),"output.json").toPath(),snap.getString("value").getBytes(StandardCharsets.UTF_8));
            status.setText("Fixture revision "+revision+" · output.json");
        } catch(Exception e){status.setText("Rejected: "+e);}
    }
    @Override public void onCreate(Bundle state){super.onCreate(state);
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);status=new TextView(this);panel.addView(status);setContentView(panel);
        try {
            File f=new File(getFilesDir(),"input.json");if(f.length()>2000000)throw new IOException("TOO_LARGE");String input=f.exists()?new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8):asset("project.json");
            port=new Port(asset("schema.json"));JSONObject r=call("open",input);if(!r.getBoolean("ok"))throw new IOException(r.toString());revision=r.getLong("revision");status.setText("Fixture revision "+revision+" · no video renderer");
            String requested=getIntent().getStringExtra("fixtureAction");for(String id:new String[]{"order","key"}){Button b=new Button(this);b.setText(id);panel.addView(b);b.setOnClickListener(v->action(id));if(id.equals(requested))b.performClick();}
        }catch(Exception e){status.setText("Input retained, not imported: "+e);}
    }
}
